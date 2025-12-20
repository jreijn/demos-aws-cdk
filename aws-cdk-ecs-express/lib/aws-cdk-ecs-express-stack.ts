import * as cdk from 'aws-cdk-lib/core';
import {CfnOutput} from 'aws-cdk-lib/core';
import {Construct} from 'constructs';
import {CfnExpressGatewayService, Cluster} from 'aws-cdk-lib/aws-ecs';
import {Vpc} from 'aws-cdk-lib/aws-ec2';
import {ManagedPolicy, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {CfnWebACL, CfnWebACLAssociation} from "aws-cdk-lib/aws-wafv2";

export class AwsCdkEcsExpressStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new Vpc(this, 'VPC', {
            maxAzs: 3,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            natGateways: 1,
            createInternetGateway: true,
            vpcName: 'cdk-ecs-express-demo-vpc',
        })

        const wafV2 = new CfnWebACL(this, "waf", {
            name: 'cdk-ecs-express-demo-waf',
            description: 'cdk-ecs-express-demo-waf',
            scope: 'REGIONAL',
            defaultAction: {
                allow: {}
            },
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: 'cdk-ecs-express-demo-waf',
                sampledRequestsEnabled: true
            },
            rules: [
                {
                    name: 'AWS-AWSManagedRulesCommonRuleSet',
                    priority: 0,
                    overrideAction: {
                        none: {}
                    },
                    statement: {
                        managedRuleGroupStatement: {
                            name: 'AWSManagedRulesCommonRuleSet',
                            vendorName: 'AWS',
                            excludedRules: []
                        }
                    },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        metricName: 'AWS-AWSManagedRulesCommonRuleSet',
                        sampledRequestsEnabled: true
                    }
                }
            ]
        });

        const cluster = new Cluster(this, 'Cluster', {
            vpc: vpc,
            clusterName: 'cdk-ecs-express-demo-cluster',
            enableFargateCapacityProviders: true,
        })

        const taskExecutionRole = new Role(this, 'executionRole', {
            roleName: 'cdk-ecs-express-demo-execution-role',
            assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'ECS Task Execution Role',
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')]
        });

        const infrastructureRole = new Role(this, 'infrastructureRole', {
            roleName: 'cdk-ecs-express-demo-infrastructure-role',
            assumedBy: new ServicePrincipal('ecs.amazonaws.com'),
            description: 'ECS Task Infrastructure Role',
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSInfrastructureRoleforExpressGatewayServices')]
        });

        let cfnExpressGatewayService = new CfnExpressGatewayService(this, 'ExpressServiceNginx1', {
            cluster: cluster.clusterName,
            primaryContainer: {
                image: 'nginx:latest',
            },
            executionRoleArn: taskExecutionRole.roleArn,
            infrastructureRoleArn: infrastructureRole.roleArn,
        });

        let cfnExpressGatewayService2 = new CfnExpressGatewayService(this, 'ExpressServiceNginx2', {
                cluster: cluster.clusterName,
                serviceName: 'express-service-nginx-2',
                primaryContainer: {
                    image: 'nginx:latest',
                },
                executionRoleArn: taskExecutionRole.roleArn,
                infrastructureRoleArn: infrastructureRole.roleArn,
                healthCheckPath: "/",
                scalingTarget: {
                    minTaskCount: 1,
                    maxTaskCount: 3,
                },
                cpu: '256',
                memory: '256',
            }
        );

        const cfnWebACLAssociation = new CfnWebACLAssociation(this, 'ALBWebACLAssociation', {
            resourceArn: cfnExpressGatewayService.getAtt("ECSManagedResourceArns.IngressPath.LoadBalancerArn").toString(),
            webAclArn: wafV2.attrArn,
        });

        cfnWebACLAssociation.addDependency(cfnExpressGatewayService);

        new CfnOutput(this, "service1url", {
            key: 'service1url',
            value: 'https://' + cfnExpressGatewayService.getAtt("Endpoint").toString()
        })
        new CfnOutput(this, "service2url", {
            key: 'service2url',
            value: 'https://' + cfnExpressGatewayService2.getAtt("Endpoint").toString()
        })
    }
}
