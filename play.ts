import * as LOG from "@dat/lib/log";
import * as ENV from '@dat/lib/env';
import * as INPUT from '@dat/lib/input';
import * as ARGVS from '@dat/lib/argvs';
import { InitCommand } from "./commands/init";
import { CloseCommand } from "./commands/close";



const VERSION = '1.1';
/***************************************** */
export async function main(): Promise<number> {
   // =>load all default configs
   await ENV.loadEnvFile();
   LOG.info(`git-flow v${VERSION} ...🚀...`);
   // =>register commands
   InitCommand
   CloseCommand

   await ARGVS.cli();

   return 0;
}

/***************************************** */




