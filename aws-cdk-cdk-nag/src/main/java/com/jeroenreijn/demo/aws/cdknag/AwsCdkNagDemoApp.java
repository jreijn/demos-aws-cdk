package com.jeroenreijn.demo.aws.cdknag;

import io.github.cdklabs.cdknag.AwsSolutionsChecks;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Aspects;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

public class AwsCdkNagDemoApp {
    public static void main(final String[] args) {
        App app = new App();

        new AwsCdkNagDemoStack(app, "AwsCdkNagDemoStack", StackProps.builder()
                .env(Environment.builder()
                        .account(System.getenv("CDK_DEFAULT_ACCOUNT"))
                        .region(System.getenv("CDK_DEFAULT_REGION"))
                        .build())
                .build());

        Aspects.of(app).add(AwsSolutionsChecks.Builder.create().build());
        app.synth();
    }
}

