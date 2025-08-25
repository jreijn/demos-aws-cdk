import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as CdkBudgetNotifications from '../lib/cdk-budget-notifications-stack';

test('Budget Created', () => {
  const app = new cdk.App();

  const stack = new CdkBudgetNotifications.CdkBudgetNotificationsStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::Budgets::Budget",1);

  template.hasResourceProperties("AWS::Budgets::Budget", {
    BudgetName:'Monthly Costs Budget'
  });
});
