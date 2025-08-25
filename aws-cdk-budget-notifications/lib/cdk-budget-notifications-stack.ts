import * as cdk from 'aws-cdk-lib';
import {Stack} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Topic} from 'aws-cdk-lib/aws-sns';
import {EmailSubscription} from "aws-cdk-lib/aws-sns-subscriptions";
import {Effect, PolicyStatement, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Key} from "aws-cdk-lib/aws-kms";

export class CdkBudgetNotificationsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        let key = new Key(this,'sns-kms-key', {
           alias: 'sns-kms-key',
           enabled: true,
           description: 'Key used for SNS topic encryption'
        });

        let topic = new Topic(this, 'budget-notifications-topic', {
            topicName: 'budget-notifications-topic',
            masterKey: key
        });

        key.addToResourcePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ["kms:GenerateDataKey*","kms:Decrypt"],
            principals: [new ServicePrincipal("budgets.amazonaws.com")],
            resources: ["*"],
            conditions: {
                StringEquals: {
                    'aws:SourceAccount': Stack.of(this).account,
                },
                ArnLike: {
                    "aws:SourceArn": "arn:aws:budgets::" + Stack.of(this).account +":*"
                }
            }
        }));

        // Add email subscription
        topic.addSubscription(new EmailSubscription("<your email address>"));

        // Add resource policy to allow the budgets service to publish to the sns topic
        topic.addToResourcePolicy(new PolicyStatement({
            actions: ["SNS:Publish"],
            effect: Effect.ALLOW,
            principals: [new ServicePrincipal("budgets.amazonaws.com")],
            resources: [topic.topicArn],
            conditions: {
                ArnEquals: {
                    'aws:SourceArn': `arn:aws:budgets::${Stack.of(this).account}:*`,
                },
                StringEquals: {
                    'aws:SourceAccount': Stack.of(this).account,
                },
            },
        }))

        // On first time deployment disable the budget as the alert will be send before you acknowledge the SNS subscription.

        // Define a fixed budget
        new cdk.aws_budgets.CfnBudget(this, 'fixed-monthly-cost-budget', {
            budget: {
                budgetType: 'COST',
                budgetLimit: {amount: 5, unit: 'USD'},
                budgetName: 'Monthly Costs Budget',
                timeUnit: 'MONTHLY'
            },
            notificationsWithSubscribers: [{
                notification: {
                    comparisonOperator: 'GREATER_THAN',
                    notificationType: 'FORECASTED',
                    threshold: 100,
                    thresholdType: 'PERCENTAGE'
                },
                subscribers: [{
                    subscriptionType: 'SNS',
                    address: topic.topicArn
                }]
            }]
        });
    }
}
