terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.16"
    }
  }

  required_version = ">= 1.2.0"
}

provider "aws" {
  profile = "tf"
  region = "ap-northeast-2"
}

# https://github.com/cloudposse/terraform-aws-msk-apache-kafka-cluster
module "kafka" {
  source = "cloudposse/msk-apache-kafka-cluster/aws"

  namespace = "pe"
  stage = "test"
  name = "msko11y"
  vpc_id = "REPLACE_WITH_YOUR_VPC_ID"
  subnet_ids = ["REPLACE_WITH_YOUR_SUBNET_ID", "REPLACE_WITH_YOUR_SUBNET_ID"]
  kafka_version = "2.8.1"
  broker_instance_type = "kafka.m5.large"
  broker_per_zone = 1
  broker_volume_size = 1000
  create_security_group = true # if false, associated_security_group_ids should be provided
  enhanced_monitoring = "PER_TOPIC_PER_BROKER"
  jmx_exporter_enabled = true
}
