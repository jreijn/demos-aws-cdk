import {Stack, StackProps} from 'aws-cdk-lib';
import {
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    KeyPair,
    MachineImage,
    Peer,
    Port,
    SecurityGroup,
    SubnetType,
    Vpc,
    WindowsVersion
} from 'aws-cdk-lib/aws-ec2';
import * as sns from 'aws-cdk-lib/aws-sns';
import {Topic} from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import {Construct} from 'constructs';
import {ManagedPolicy, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {StringParameter} from "aws-cdk-lib/aws-ssm";
import {Alarm, ComparisonOperator, Metric, TreatMissingData, Unit} from "aws-cdk-lib/aws-cloudwatch";
import {SnsAction} from "aws-cdk-lib/aws-cloudwatch-actions";

export class AwsCdkWindowsDiskspaceMonitoringStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const demoVpc = new Vpc(this, "demo-vpc", {
            enableDnsHostnames: true,
            enableDnsSupport: true,
            createInternetGateway: true,
            maxAzs: 2,
            natGateways: 1,
            vpcName: "demo-vpc"
        })

        const role = new Role(this, "instance-role", {
            assumedBy: new ServicePrincipal("ec2.amazonaws.com")
        });

        role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy"));
        role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

        const keyPair = new KeyPair(this, 'windows-key-pair', {
            keyPairName: 'windows-demo-key'
        });

        const securityGroup = new SecurityGroup(this, 'security-group', {
            vpc: demoVpc,
            allowAllOutbound: true,
            description: "SG for EC2 instance"
        })

        const instance = new Instance(this, "windows-demo-instance", {
            vpc: demoVpc,
            instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.SMALL),
            machineImage: MachineImage.latestWindows(WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE),
            securityGroup: securityGroup,
            role: role,
            keyPair: keyPair,
            associatePublicIpAddress: false,
            vpcSubnets: {subnetType: SubnetType.PRIVATE_WITH_EGRESS},
            detailedMonitoring: true,
        })
        securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(3389), "Allow RDP Connections")

        const cwAgentConfigParam = this.createCloudWatchAgentConfiguration(role);

        // Write config to disk and install agent
        instance.userData.addCommands(
            // Install CW Agent via MSI
            `powershell.exe -Command "Invoke-WebRequest https://s3.amazonaws.com/amazoncloudwatch-agent/windows/amd64/latest/amazon-cloudwatch-agent.msi -OutFile C:\\cwagent.msi"`,
            `msiexec /i C:\\cwagent.msi /qn /l*v C:\\cwagent-install.log`,
            // Wait for installation to complete
            `timeout /t 30`,
            // Start the agent with proper PowerShell execution
            `powershell.exe -ExecutionPolicy Bypass -Command "& 'C:\\Program Files\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent-ctl.ps1' -a fetch-config -m ec2 -c ssm:${cwAgentConfigParam.parameterName} -s"`,
            // Wait for agent to start and load
            `timeout /t 30`,
            // check agent status
            `powershell.exe -ExecutionPolicy Bypass -Command "& 'C:\\Program Files\\Amazon\\AmazonCloudWatchAgent\\amazon-cloudwatch-agent-ctl.ps1' -a status -m ec2"`,
        );
        let topic = this.createSNSTopic();
        this.generateAlarms(instance, topic);
    }

    private generateAlarms(instance: Instance, topic: Topic) {
        // Low diskspace alarm for C drive
        let lowDiskSpaceCVolumeAlarm = new Alarm(this, 'alarm', {
            alarmDescription: 'This metric monitors the amount of free disk space on the instance. If the amount of free disk space falls below 10% for 5 minutes, the alarm will trigger',
            metric: new Metric({
                dimensionsMap: {
                    InstanceId: instance.instanceId,
                    objectname: "LogicalDisk",
                    instance: "C:"
                },
                statistic: "Average",
                namespace: "CWAgent",
                metricName: "LogicalDisk % Free Space",
                unit: Unit.PERCENT,
            }),
            threshold: 10,
            evaluationPeriods: 5,
            datapointsToAlarm: 5,
            comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: TreatMissingData.MISSING,
        });
        lowDiskSpaceCVolumeAlarm.addAlarmAction(new SnsAction(topic));
        lowDiskSpaceCVolumeAlarm.addOkAction(new SnsAction(topic));

        // Low Available Memory Alarm
        let lowAvailableMemoryAlarm = new Alarm(this, 'low-available-memory-alarm', {
            alarmDescription: 'Triggers if memory usage is continually high for 15 minutes',
            metric: new Metric({
                dimensionsMap: {
                    InstanceId: instance.instanceId,
                    objectname: "Memory",
                },
                statistic: "Maximum",
                namespace: "CWAgent",
                metricName: "Memory % Committed Bytes in Use"
            }),
            threshold: 90,
            evaluationPeriods: 15,
            datapointsToAlarm: 15,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: TreatMissingData.NOT_BREACHING,
        });
        lowAvailableMemoryAlarm.addAlarmAction(new SnsAction(topic));
        lowAvailableMemoryAlarm.addOkAction(new SnsAction(topic));
    }

    private createCloudWatchAgentConfiguration(role: Role) {
        const cwAgentConfig = {
            agent: {
                metrics_collection_interval: 60
            },
            metrics: {
                namespace: "CWAgent",
                append_dimensions: {
                    InstanceId: "\${aws:InstanceId}",
                },
                metrics_collected: {
                    LogicalDisk: {
                        measurement: [
                            {name: "% Free Space", "unit": "Percent"},
                            {name: "Free Megabytes", unit: "Megabytes"},
                        ],
                        "resources": [
                            "*"
                        ]
                    },
                    PhysicalDisk: {
                        measurement: [
                            "% Disk Time",
                            "Disk Write Bytes/sec",
                            "Disk Read Bytes/sec",
                            "Disk Writes/sec",
                            "Disk Reads/sec"
                        ],
                        "resources": [
                            "*"
                        ]
                    },
                    "Paging File": {
                        measurement: [
                            "% Usage"
                        ],
                        metrics_collection_interval: 60,
                        resources: [
                            "*"
                        ]
                    },
                    Memory: {
                        metrics_collection_interval: 5,
                        measurement: [
                            {"name": "% Committed Bytes in Use", "unit": "Percent"},
                        ],
                        "resources": [
                            "*"
                        ]
                    },
                    Processor: {
                        measurement: [
                            "% User Time",
                            "% Idle Time",
                            "% Interrupt Time"
                        ],
                        metrics_collection_interval: 60,
                        resources: [
                            "_Total"
                        ]
                    },
                    TCPv4: {
                        measurement: [
                            "Connections Established"
                        ],
                        "metrics_collection_interval": 60
                    },
                }
            }
        };

        const configJson = JSON.stringify(cwAgentConfig);

        const cwAgentConfigParam = new StringParameter(this, 'cw-agent-config', {
            parameterName: '/ec2/cw-agent-config.json',
            stringValue: configJson
        });

        cwAgentConfigParam.grantRead(role);
        return cwAgentConfigParam;
    }

    private createSNSTopic() {
        const topic = new sns.Topic(this, 'AwsCdkWindowsDiskspaceMonitoringTopic');
        topic.addSubscription(new subs.EmailSubscription("j.reijn@gmail.com"));
        return topic;
    }
}
