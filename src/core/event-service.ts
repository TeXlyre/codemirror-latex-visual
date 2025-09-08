// src/core/event-service.ts
import { errorService, ErrorCategory, ErrorSeverity } from './error-service';

export type EventListener<T = any> = (data: T) => void;
export type EventUnsubscribe = () => void;

export interface WidgetUpdateEvent {
  widgetId: string;
  widgetType: string;
  oldValue: string;
  newValue: string;
  source: 'user' | 'programmatic';
}

export interface ModeChangeEvent {
  oldMode: 'source' | 'visual';
  newMode: 'source' | 'visual';
  triggeredBy: 'user' | 'api';
}

export interface FocusChangeEvent {
  type: 'widget' | 'editor' | 'toolbar' | 'cell';
  element: HTMLElement;
  widgetType?: string;
}

export class EventService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private globalListeners: Map<string, { listener: EventListener; cleanup: () => void }> = new Map();

  private static instance: EventService;

  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  emit<T>(eventType: string, data: T): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          errorService.logError(
            ErrorCategory.STATE,
            ErrorSeverity.ERROR,
            `Error in event listener for ${eventType}`,
            { eventType, data, error }
          );
        }
      });
    }
  }

  on<T>(eventType: string, listener: EventListener<T>): EventUnsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener);

    return () => {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        eventListeners.delete(listener);
        if (eventListeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  once<T>(eventType: string, listener: EventListener<T>): EventUnsubscribe {
    const unsubscribe = this.on(eventType, (data: T) => {
      unsubscribe();
      listener(data);
    });
    return unsubscribe;
  }

  addGlobalEventListener(
    target: EventTarget,
    eventType: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): EventUnsubscribe {
    const wrappedListener = (event: Event) => {
      try {
        listener(event);
      } catch (error) {
        errorService.logError(
          ErrorCategory.DOM,
          ErrorSeverity.ERROR,
          `Error in global event listener for ${eventType}`,
          { eventType, error }
        );
      }
    };

    target.addEventListener(eventType, wrappedListener, options);

    const key = `${eventType}_${Math.random().toString(36).substr(2, 9)}`;
    const cleanup = () => {
      target.removeEventListener(eventType, wrappedListener, options);
      this.globalListeners.delete(key);
    };

    this.globalListeners.set(key, { listener: wrappedListener, cleanup });

    return cleanup;
  }

  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  cleanup(): void {
    this.listeners.clear();
    this.globalListeners.forEach(({ cleanup }) => cleanup());
    this.globalListeners.clear();
  }

  // Convenience methods for common events
  onWidgetUpdate(listener: EventListener<WidgetUpdateEvent>): EventUnsubscribe {
    return this.on('widget:update', listener);
  }

  emitWidgetUpdate(event: WidgetUpdateEvent): void {
    this.emit('widget:update', event);
  }

  onModeChange(listener: EventListener<ModeChangeEvent>): EventUnsubscribe {
    return this.on('mode:change', listener);
  }

  emitModeChange(event: ModeChangeEvent): void {
    this.emit('mode:change', event);
  }

  onFocusChange(listener: EventListener<FocusChangeEvent>): EventUnsubscribe {
    return this.on('focus:change', listener);
  }

  emitFocusChange(event: FocusChangeEvent): void {
    this.emit('focus:change', event);
  }
}