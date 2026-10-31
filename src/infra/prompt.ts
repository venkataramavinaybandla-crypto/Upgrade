import readline from 'node:readline';
import type { Prompt, PromptSelectOption, PromptTextOptions } from '../ports/index.js';

export class ReadlinePrompt implements Prompt {
  private ask(questionText: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise(resolve => {
      rl.question(questionText, answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  async confirm(msg: string): Promise<boolean> {
    const answer = await this.ask(`${msg} (y/N) `);
    return /^y(es)?$/i.test(answer);
  }

  async select<T = string>(msg: string, options: PromptSelectOption<T>[]): Promise<T> {
    console.log(msg);
    options.forEach((opt, idx) => {
      console.log(`  [${idx + 1}] ${opt.label}${opt.hint ? ` (${opt.hint})` : ''}`);
    });
    while (true) {
      const answer = await this.ask(`Choose 1-${options.length}: `);
      const num = parseInt(answer, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        return options[num - 1].value;
      }
      console.log(`Please enter a number between 1 and ${options.length}.`);
    }
  }

  async text(msg: string, opts?: PromptTextOptions): Promise<string> {
    const promptSuffix = opts?.defaultValue ? ` [${opts.defaultValue}] ` : ' ';
    const answer = await this.ask(`${msg}${promptSuffix}`);
    if (!answer && opts?.defaultValue) {
      return opts.defaultValue;
    }
    return answer;
  }

  async pickFolder(startAt?: string): Promise<string | undefined> {
    const res = await this.text(`Enter folder path${startAt ? ` [${startAt}]` : ''}:`);
    return res || startAt;
  }
}
