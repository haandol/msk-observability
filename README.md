# MSK Observability Demo

# Prerequisite

- setup awscli
- node 16.x
- cdk 2.x

# Installation

open [**infra/env/dev.env**](/infra/env/dev.env) and fill the blow fields

> Remove all optional fields for empty value (empty value will be failed on validation)

- `VPC_ID` (optional): if necessary.
- `SUBNET_IDS` (optional, but it is required when the `VPC_ID` is given): if necessary, comma separated subnet ids. e.g. "subnet-xxxxxxxx,subnet-xxxxxxxx".
- `AWS_ACCOUNT_ID`: 12 digit account id
- `AWS_REGION`: e.g. "ap-northeast-2"

and copy `env/dev.env` file to project root as `.env`

```bash
$ cd infra
$ cp env/dev.env .env
```

```bash
$ npm i
```

bootstrap cdk if no one has run it on the target region

```bash
$ cdk bootstrap
```

deploy infra

```
$ cdk deploy "*" --require-approval never
```
