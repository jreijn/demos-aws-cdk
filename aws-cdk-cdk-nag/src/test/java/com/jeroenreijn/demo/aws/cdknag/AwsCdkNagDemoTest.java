package com.jeroenreijn.demo.aws.cdknag;

import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.assertions.Template;

import java.util.HashMap;

public class AwsCdkNagDemoTest {

    @Test
    public void testStack() {
        App app = new App();
        AwsCdkNagDemoStack stack = new AwsCdkNagDemoStack(app, "test");

        Template template = Template.fromStack(stack);

        template.hasResourceProperties("AWS::SQS::Queue", new HashMap<String, Number>() {{
            put("VisibilityTimeout", 300);
        }});
    }
}
