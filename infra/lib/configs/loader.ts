import * as path from 'path';
import * as joi from 'joi';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});

console.log('process.env', process.env);

const schema = joi
  .object({
    AWS_ACCOUNT_ID: joi.string().required(),
    AWS_REGION: joi.string().required(),
    STAGE: joi.string().valid('Dev', 'Prod').required(),
    NS: joi.string().required(),
  })
  .unknown();

const { value: envVars, error } = schema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const Config = {
  AWS: {
    Account: envVars.AWS_ACCOUNT_ID,
    Region: envVars.AWS_REGION,
  },
  Stage: envVars.STAGE,
  Ns: `${envVars.NS}${envVars.STAGE}`,
  VpcID: envVars.VPC_ID,
};
