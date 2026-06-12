// ??$$$ newer code - LogicEngine evaluates simulation rules on bus events
import type { GPIOBus } from './GPIOBus';
import type { LogicRule } from '../../../../shared/types/SimulationBundle';

export class LogicEngine {
  private rules: LogicRule[];
  private bus: GPIOBus;
  private onLog: (text: string) => void;
  private unsubs: (() => void)[] = [];

  constructor(rules: LogicRule[], bus: GPIOBus, onLog: (text: string) => void) {
    this.rules = rules || [];
    this.bus = bus;
    this.onLog = onLog;
  }

  start() {
    this.stop();

    // Map input pins/keys to their rules
    const rulesByInput = new Map<string, LogicRule[]>();
    for (const rule of this.rules) {
      const input = rule.inputPinOrKey;
      const list = rulesByInput.get(input) || [];
      list.push(rule);
      rulesByInput.set(input, list);
    }

    // Subscribe to all inputs
    for (const [input, rules] of rulesByInput.entries()) {
      const unsub = this.bus.on(input, (val) => {
        this.evaluateRules(rules, val);
      });
      this.unsubs.push(unsub);
    }
  }

  private evaluateRules(rules: LogicRule[], inputValue: any) {
    for (const rule of rules) {
      let isMet = false;
      const valNum = Number(inputValue);
      const threshNum = Number(rule.threshold);

      // If both are numbers, compare numerically, else lexicographically
      if (!isNaN(valNum) && !isNaN(threshNum)) {
        switch (rule.operator) {
          case '<': isMet = valNum < threshNum; break;
          case '>': isMet = valNum > threshNum; break;
          case '<=': isMet = valNum <= threshNum; break;
          case '>=': isMet = valNum >= threshNum; break;
          case '==': isMet = valNum === threshNum; break;
          case '!=': isMet = valNum !== threshNum; break;
        }
      } else {
        const valStr = String(inputValue).toLowerCase();
        const threshStr = String(rule.threshold).toLowerCase();
        switch (rule.operator) {
          case '==': isMet = valStr === threshStr; break;
          case '!=': isMet = valStr !== threshStr; break;
          default: isMet = false;
        }
      }

      if (isMet) {
        // Execute rule action
        const actionVal = rule.actionValue === 'true' ? true : rule.actionValue === 'false' ? false : rule.actionValue;
        this.onLog(`[LOGIC] Rule matched: ${rule.inputPinOrKey} (${inputValue}) ${rule.operator} ${rule.threshold} → writing ${actionVal} to ${rule.outputPinOrKey}`);
        this.bus.write(rule.outputPinOrKey, actionVal);
      }
    }
  }

  stop() {
    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];
  }
}
