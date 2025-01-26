export enum EventType {
  BufferReachedEnd = 'BufferReachedEnd',
}

export class EventManager {
  private listeners: Partial<Record<EventType, Function[]>> = {}

  constructor() {}

  public addEventListener(event: EventType, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }

    this.listeners[event].push(listener)
  }

  public removeEventListener(event: EventType, listener: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((l) => l !== listener)
    }
  }

  public emit(event: EventType, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => listener(...args))
    }
  }
}
