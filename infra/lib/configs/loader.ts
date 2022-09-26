import * as path from 'path';
import * as joi from 'joi';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env'),
});

const schema = joi
  .object({
    STAGE: joi.string().valid('Dev', 'Prod').required(),
    NS: joi.string().required(),
  })
  .unknown();

const { value: envVars, error } = schema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const Config = {
  Stage: envVars.STAGE,
  Ns: `${envVars.NS}${envVars.STAGE}`,
  VpcID: envVars.VPC_ID,
};
