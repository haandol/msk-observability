import { Stack, StackProps, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as appasg from 'aws-cdk-lib/aws-applicationautoscaling';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { Config } from '../configs/loader';
import { MskDashboard } from '../constructs/msk-dashboard';

interface IProps extends StackProps {
  vpc: ec2.IVpc;
}

export class MskStack extends Stack {
  public readonly cluster: msk.ICluster;

  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id, props);

    this.cluster = this.newCluster(props);
    new MskDashboard(this, `MskDashboard`, {
      cluster: this.cluster,
    });
  }

  newCluster(props: IProps): msk.ICluster {
    const securityGroup = new ec2.SecurityGroup(this, `MskSecurityGroup`, {
      vpc: props.vpc,
      securityGroupName: `${Config.Ns}MskSecurityGroup`,
    });
    securityGroup.connections.allowInternally(ec2.Port.allTraffic());

    const cluster = new msk.Cluster(this, `MskCluster`, {
      clusterName: `${Config.Ns.toLowerCase()}`,
      kafkaVersion: msk.KafkaVersion.V2_8_1,
      numberOfBrokerNodes: 1,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.M5,
        ec2.InstanceSize.LARGE
      ),
      ebsStorageInfo: { volumeSize: 1000 },
      monitoring: {
        clusterMonitoringLevel:
          msk.ClusterMonitoringLevel.PER_TOPIC_PER_PARTITION,
        enablePrometheusJmxExporter: true,
        enablePrometheusNodeExporter: true,
      },
      logging: {
        cloudwatchLogGroup: new logs.LogGroup(this, `${Config.Ns}MSKLogGroup`, {
          logGroupName: `/aws/kafka/broker/${Config.Ns.toLowerCase()}`,
          retention: logs.RetentionDays.TWO_WEEKS,
        }),
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // storage auto scaling
    // from 1000 (default) to 4096 Gib
    const target = new appasg.ScalableTarget(this, `MskStorageASGTarget`, {
      minCapacity: 1,
      maxCapacity: 4096,
      resourceId: cluster.clusterArn,
      scalableDimension: 'kafka:broker-storage:VolumeSize',
      serviceNamespace: appasg.ServiceNamespace.KAFKA,
    });
    new appasg.TargetTrackingScalingPolicy(this, 'MskStorageASGPolicy', {
      policyName: `${Config.Ns}StorageAutoScaling`,
      scalingTarget: target,
      predefinedMetric:
        appasg.PredefinedMetric.KAFKA_BROKER_STORAGE_UTILIZATION,
      targetValue: 75,
      disableScaleIn: true,
    });

    return cluster;
  }
}
