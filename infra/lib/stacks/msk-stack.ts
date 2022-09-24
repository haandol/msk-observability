import {
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
  Duration,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as appasg from 'aws-cdk-lib/aws-applicationautoscaling';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { Config } from '../configs/loader';

interface IProps extends StackProps {
  vpc: ec2.IVpc;
  securytyGroup: ec2.ISecurityGroup;
}

export class MskStack extends Stack {
  public readonly cluster: msk.ICluster;

  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id, props);

    this.cluster = this.newCluster(props);

    const topic = this.newTopic();
    this.newBrokerAlarms(this.cluster, topic);
    this.newApplicationAlarms(this.cluster, topic);
  }

  newTopic(): sns.ITopic {
    return new sns.Topic(this, `NotificationTopic`, {
      displayName: `${Config.Ns.toLowerCase()}-kafka-notification`,
      topicName: `${Config.Ns.toLowerCase()}-kafka-notification`,
    });
  }

  newCluster(props: IProps): msk.ICluster {
    const cluster = new msk.Cluster(this, `MskCluster`, {
      clusterName: `${Config.Ns.toLowerCase()}`,
      kafkaVersion: msk.KafkaVersion.V2_8_1,
      numberOfBrokerNodes: 1,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securytyGroup],
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
      removalPolicy: RemovalPolicy.DESTROY,
    });
    cluster.connections.allowInternally(ec2.Port.allTraffic());

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

  newBrokerAlarms(cluster: msk.ICluster, topic: sns.ITopic) {
    // ActiveControllerCount
    new cw.Alarm(this, `ActiveControllerAlarm`, {
      alarmName: `${Config.Ns}KafkaActiveControllerCount`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'ActiveControllerCount',
        period: Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
        dimensionsMap: {
          'Cluster Name': cluster.clusterName,
        },
      }),
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      threshold: 1 / 2, // (1 / brokercounts)
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // UnderReplicatedPartitions
    new cw.Alarm(this, `UnderReplicatedPartitionsAlarm`, {
      alarmName: `${Config.Ns}KafkaUnderReplicatedPartitions`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'UnderReplicatedPartitions',
        period: Duration.minutes(1),
        statistic: cw.Statistic.SUM,
        dimensionsMap: {
          'Cluster Name': cluster.clusterName,
        },
      }),
      threshold: 0,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // OfflinePartitionsCount
    new cw.Alarm(this, `OfflinePartitionsCountAlarm`, {
      alarmName: `${Config.Ns}KafkaOfflinePartitionsCount`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'OfflinePartitionsCount',
        period: Duration.minutes(1),
        statistic: cw.Statistic.SUM,
      }),
      threshold: 0,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // CpuUser
    new cw.Alarm(this, `CpuUser`, {
      alarmName: `${Config.Ns}KafkaCpuUser`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'CpuUser',
        period: Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
        dimensionsMap: {
          'Cluster Name': cluster.clusterName,
        },
      }),
      threshold: 60,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // KafkaDataLogsDiskUsed
    new cw.Alarm(this, `KafkaDataLogsDiskUsed`, {
      alarmName: `${Config.Ns}KafkaDataLogsDiskUsed`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'KafkaDataLogsDiskUsed',
        period: Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
        dimensionsMap: {
          'Cluster Name': cluster.clusterName,
        },
      }),
      threshold: 85,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));
  }

  newApplicationAlarms(cluster: msk.ICluster, topic: sns.ITopic) {
    // MaxOffsetLag
    // You can specify the metric using the consumer-group or topic name
    new cw.Alarm(this, `KafkaMaxOffsetLag`, {
      alarmName: `${Config.Ns}KafkaMaxOffsetLag`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'MaxOffsetLag',
        period: Duration.minutes(1),
        statistic: cw.Statistic.MAXIMUM,
        dimensionsMap: {
          'Cluster Name': cluster.clusterName,
        },
      }),
      threshold: 100,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));

    // OffsetLag
    // You can specify the metric using the consumer-group or topic name
    new cw.Alarm(this, `KafkaOffsetLag`, {
      alarmName: `${Config.Ns}KafkaOffsetLag`,
      metric: new cw.Metric({
        namespace: 'AWS/Kafka',
        metricName: 'MaxOffsetLag',
        period: Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
        dimensionsMap: {
          'Cluster Name': cluster.clusterName,
        },
      }),
      threshold: 100,
      evaluationPeriods: 3,
    }).addAlarmAction(new cwActions.SnsAction(topic));
  }
}
