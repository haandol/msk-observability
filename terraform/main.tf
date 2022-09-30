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
  vpc_id = "vpc-0dc9e60d117e95539"
  subnet_ids = ["subnet-0aecbe866e3d195b3", "subnet-096dd40097ff0de91"]
  kafka_version = "2.8.1"
  broker_instance_type = "kafka.m5.large"
  broker_per_zone = 1
  broker_volume_size = 1000
  create_security_group = true # if false, associated_security_group_ids should be provided
  enhanced_monitoring = "PER_TOPIC_PER_BROKER"
  jmx_exporter_enabled = true
}