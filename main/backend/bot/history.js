const MAX = 16;

export class History {
  constructor() {
    this.messages = [];
  }

  add(role, content) {
    this.messages.push({ role, content });
    if (this.messages.length > MAX) {
      this.messages = this.messages.slice(-MAX);
    }
  }

  getMessages() {
    return [...this.messages];
  }

  reset() {
    this.messages = [];
  }
}
