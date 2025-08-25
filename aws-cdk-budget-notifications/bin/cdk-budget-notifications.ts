#!/usr/local/opt/node/bin/node
import * as cdk from 'aws-cdk-lib';
import { CdkBudgetNotificationsStack } from '../lib/cdk-budget-notifications-stack';

const app = new cdk.App();
new CdkBudgetNotificationsStack(app, 'budget-notification-stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});