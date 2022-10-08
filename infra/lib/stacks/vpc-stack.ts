import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface IProps extends StackProps {
  vpcId?: string;
}

export class VpcStack extends Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id, props);

    // import or create vpc
    if (props.vpcId) {
      this.vpc = ec2.Vpc.fromLookup(this, `Vpc`, { vpcId: props.vpcId });
    } else {
      this.vpc = new ec2.Vpc(this, `Vpc`, { maxAzs: 3 });
    }
  }
}
