// class IEvent {
//     public type: string;
//     public timestamp: number;
//     // public page: string;

//     public constructor(event: any) {
//         this.type = event.type;
//         this.timestamp = performance.now();
//         // this.page = location.href;
//     }
// }

// class IUserEvent extends IEvent {
//     public target: string;

//     public constructor(event: any) {
//         super(event);
//         this.target = event.target.outerHTML;
//     }
// }

// class IInputEvent extends IUserEvent {
//     public value: {
//         type: string;
//         length: number;
//     };

//     public constructor(event: FocusEvent) {
//         super(event);
//         let target: HTMLInputElement = <HTMLInputElement>event.target;
//         this.value = {
//             type: 'alphanumeric',
//             length: target.value.length
//         };
//     }
// }

// class IMouseEvent extends IUserEvent {
//     public altKey: boolean;
//     public shiftKey: boolean;
//     public metaKey: boolean;

//     public constructor(event: MouseEvent) {
//         super(event);
//         this.altKey = event.altKey;
//         this.shiftKey = event.shiftKey;
//         this.metaKey = event.metaKey;
//     }
// }

// class IConsoleEvent extends IEvent {
//     public severity: string;
//     public message: string;

//     public constructor(severity: string, args: any) {
//         super({
//             type: 'console',
//         });
//         this.severity = severity;
//         this.message = JSON.stringify(Array.prototype.slice.call(args));
//     }
// }

// class IErrorEvent extends IEvent {
//     public line: number;
//     public column: number;
//     public filename: string;
//     public message: string;
//     public stack: string;

//     public constructor(event: ErrorEvent) {
//         super(event);
//         this.line = event.lineno;
//         this.column = event.colno;
//         this.filename = event.filename;
//         this.message = event.error.message;
//         this.stack = event.error.stack;
//     }
// }

// class IXHREvent extends IEvent {
//     public method: string;
//     public url: string;
//     public endTime: number;
//     public status: number;
//     public statusText: string;

//     public constructor(method: string, url: string, endTime?: number, status?: number, statusText?: string) {
//         super({
//             type: 'xhr'
//         });
//         this.method = method;
//         this.url = url;
//         this.endTime = endTime;
//         this.status = status;
//         this.statusText = statusText;
//     }
// }

// class Backtrack {
//     private queue: MessageQueue = new MessageQueue();
//     private obj: DataObject;

//     // TODO: Add options.
//     // Do not add window.onerror listener by default. Add track() method that takes errors as parameters
//     public constructor() {
//         this.obj = new DataObject();

//         window.addEventListener('click', (event: MouseEvent) => this.onClick(event), true);
//         window.addEventListener('blur', (event: FocusEvent) => this.onBlur(event), true);
//         window.addEventListener('error', (error: ErrorEvent) => this.onError(error), true);

//         this.patchConsole();
//         this.watchNetworkObject(XMLHttpRequest.prototype);

//         window.backtrace = {
//             version: '0.0.1'
//         }
//     }

//     private onClick(event: MouseEvent): void {
//         let target: Element = this.getTarget(event);

//         if (target && target.tagName && this.isElement(target, 'a') || this.isElement(target, 'button')) {
//             this.obj.add('user', new IMouseEvent(event));
//         }
//     }

//     private onBlur(event: FocusEvent): void {
//         let target: Element = this.getTarget(event);

//         if (target && target.tagName && this.isElement(target, 'input')) {
//             this.obj.add('user', new IInputEvent(event));
//         }
//     }

//     private onError(error: ErrorEvent): void {
//         this.obj.parseError(new IErrorEvent(error));
//         this.queue.add(this.obj);
//         this.obj = new DataObject();
//     }

//     private patchConsole() {
//         const methods: string[] = ['log', 'debug', 'info', 'warn', 'error'];
//         const self = this;

//         for (let i: number = 0; i < methods.length; ++i) {
//             let old = console[methods[i]];

//             console[methods[i]] = function() {
//                 self.obj.add('console', new IConsoleEvent(methods[i], arguments));
//                 old.apply(this, arguments);
//             }
//         }
//     }

//     private watchNetworkObject(request: XMLHttpRequest): void {
//         let open: Function = request.open;
//         let send: Function = request.send;
//         let self = this;

//         let xhrEvent: IXHREvent;

//         request.open = function(method: string, url: string): void {
//             xhrEvent = new IXHREvent(method, url);

//             return open.apply(this, arguments);
//         };

//         request.send = function(): void {
//             self.listenForNetworkComplete(this, xhrEvent);
//             return send.apply(this, arguments);
//         };
//     }

//     private listenForNetworkComplete(request: XMLHttpRequest, xhrEvent: IXHREvent): void {
//         let self = this;

//         request.addEventListener('readystatechange', function(): void {
//             if (request.readyState === 4) {
//                 xhrEvent.endTime = performance.now();
//                 self.finalizeNetworkEvent(request, xhrEvent);
//             }
//         }, true);
//     }

//     private finalizeNetworkEvent(response: XMLHttpRequest, xhrEvent: IXHREvent): void {
//         xhrEvent.status = response.status;
//         xhrEvent.statusText = response.statusText;
//         // TODO: Ignore captureUrl requests
//         this.obj.add('network', xhrEvent);
//     }

//     private getTarget(event: MouseEvent | FocusEvent): Element {
//         return <Element> event.target || document.elementFromPoint((<MouseEvent>event).clientX, (<MouseEvent>event).clientY);
//     }

//     private isElement(element: Element, tagName: string): boolean {
//         if (element.tagName.toLowerCase() !== tagName.toLowerCase()) {
//             return false;
//         }

//         return true;
//     }
// }

// class DataObject {
//     public metadata: any;
//     private timestamp: number;
//     private environment: any;
//     private line: number;
//     private column: number;
//     private filename: string;
//     private message: string;
//     private stack: string;
//     private url: string;

//     private network: IXHREvent[];
//     private console: IConsoleEvent[];
//     private user: IUserEvent[];

//     public constructor() {
//         this.network = [];
//         this.console = [];
//         this.user = [];

//         this.environment = {
//             userAgent: window.navigator.userAgent,
//             viewport: {
//                 width: window.screen.width,
//                 height: window.screen.height
//             }
//         };

//         this.metadata = {};
//     }

//     public add(type: string, event: IEvent): void {
//         this[type].push(event);
//     }

//     public parseError(error: IErrorEvent) {
//         this.timestamp = error.timestamp;
//         this.line = error.line;
//         this.column = error.column;
//         this.filename = error.filename;
//         this.message = error.message;
//         this.stack = error.stack;
//         this.url = location.href;
//     }
// }

// class MessageQueue {
//     private captureUrl: string = 'http://localhost:3000/api/capture';
//     private queue: DataObject[];
//     private isOnline: boolean = true;

//     public constructor() {
//         this.queue = [];

//         // If offline -> online send whole queue
//         window.addEventListener('offline', () => this.onOffline(), true);
//         window.addEventListener('online', () => this.onOnline(), true);
//     }

//     public add(data: DataObject): void {
//         this.queue.push(data);

//         if (this.isOnline) {
//             this.upload();
//         }
//     }

//     public clear(): void {
//         this.queue = [];
//     }

//     private upload(): void {
//         if (this.queue.length === 0) {
//             return;
//         }

//         let request: XMLHttpRequest = new XMLHttpRequest();
//         request.open('POST', this.captureUrl, true);
//         request.setRequestHeader('Content-Type', 'application/json');
//         // request.addEventListener('load', () => this.listener()); // TODO: Remove event listener?
//         request.send(JSON.stringify(this.queue));
//         // TODO: Should only clear on response 2xx (204)
//         this.clear();
//     }

//     private onOnline() {
//         console.debug('isOnline');
//         this.isOnline = true;
//         this.upload();
//     }

//     private onOffline() {
//         console.debug('isOffline');
//         this.isOnline = false;
//     }
// }

// !function() {
//     new Backtrack();
// } ();

interface ExtendedWindow extends Window {
    angular?: any;
    jQuery?: any;
    [dep: string]: {
        version?: string;
        Version?: string;
        VERSION?: string;
    }
}

interface IKeyValueStore {
    [key: string]: any;
}

class MessageQueue {
    public metadata: Metadata;

    private queue: BaseEvent[];
    private captureUrl = 'http://localhost:3000/api/capture';
    private dependencies: IKeyValueStore;
    private uuid: string;

    public constructor(metadata: Metadata) {
        this.metadata = metadata;
        this.queue = [];
        this.dependencies = this.getDependencies();
        this.uuid = this.generateUuid();
    }

    public add(message: BaseEvent): BaseEvent {
        if (message instanceof XHREvent && message.type === 'xhr' && message.url === this.captureUrl) {
            return null;
        }

        this.queue.push(message);
        return message;
    }

    public send(): void {
        if (this.queue.length === 0) {
            return;
        }

        let request: XMLHttpRequest = new XMLHttpRequest();
        request.open('POST', this.captureUrl, true);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify(this.wrapQueue()));
        this.queue = [];
    }

    private wrapQueue() {
        return {
            timestamp: Date.now(),
            environment: {
                uuid: this.uuid,
                useragent: navigator.userAgent,
                viewport: {
                    width: window.document.documentElement.clientWidth,
                    height: window.document.documentElement.clientHeight
                },
                dependencies: this.dependencies
            },
            metadata: this.metadata,
            events: this.queue
        };
    }

    private getDependencies() {
        let dependencies: any = {
            backtrace: Backtrace.VERSION
        };

        const w = <ExtendedWindow> window;
        const angular = w.angular;
        const jQuery = w.jQuery;

        if (jQuery) {
            if (jQuery.fn && jQuery.fn.jquery) {
                dependencies.jQuery = jQuery.fn.jquery;
            }

            if (jQuery.ui && jQuery.ui.version) {
                dependencies.jQueryUI = jQuery.ui.version;
            }
        }

        if (angular && angular.version && angular.version.full) {
            dependencies.angular = angular.version.full;
        }

        for (let dep in w) {
            if (dep !== 'webkitStorageInfo' && dep !== 'webkitIndexedDB') { // && "top" !== a && "parent" !== a && "frameElement" !== a
                try {
                    if (w[dep]) {
                        let version = w[dep].version || w[dep].Version || w[dep].VERSION;

                        if (typeof version === 'string') {
                            dependencies[dep] = version;
                        }
                    }
                } catch (err) {}
            }
        }
        return dependencies;
    }

    /**
     * Generate RFC 4122 compliant uuid
     */
    private generateUuid() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(character) {
            const rand = 16 * Math.random() | 0;
            return (character === 'x' ? rand : (rand & 3 | 8)).toString(16)
        });
    }
}

class Metadata {
    private data: IKeyValueStore;

    public constructor() {
        this.data = {};
    }

    public set(key: string, value: string | number | boolean): void {
        this.data[key] = value;
    }

    public get(key: string): string | number | boolean {
        return this.data[key];
    }

    public toJSON() {
        return this.data;
    }
}

/*
    TODO
    config -> interval, capture url, capacity (sliding window size -- if interval capacity reached will trigger push and reset interval)
    online/offline support
*/
class Backtrace {
    public static VERSION = '0.0.1';
    public metadata: Metadata;

    private queue: MessageQueue;

    public constructor() {
        this.metadata = new Metadata();
        this.queue = new MessageQueue(this.metadata);

        setInterval(this.flush.bind(this), 10000);
        this.addListeners();
    }

    public custom(event: any, includeLocation?: boolean) {
        this.queue.add(new CustomEvent(event, includeLocation));
    }

    private flush(): void {
        this.queue.send();
    }

    private addListeners(): void {
        window.addEventListener('click', this.onClick.bind(this), true);
        window.addEventListener('blur', this.onBlur.bind(this), true);
        window.addEventListener('error', this.onError.bind(this), true);

        this.patchXHR(XMLHttpRequest.prototype);
        this.patchConsole();
    }

    private onClick(event: MouseEvent): void {
        const timestamp = Date.now();
        let target: Element = this.getTarget(event);

        if (this.isElement(target, 'a') || this.isElement(target, 'button')) {
            this.queue.add(new ClickEvent(target, timestamp));
        }
    }

    private onBlur(event: FocusEvent): void {
        const timestamp = Date.now();
        let target: Element = this.getTarget(event);

        if (this.isElement(target, 'input') || this.isElement(target, 'textarea')) {
            this.queue.add(new InputEvent(<HTMLInputElement> target, timestamp));
        }
    }

    private onError(event: ErrorEvent): void {
        const timestamp = Date.now();
        this.queue.add(new BErrorEvent(event, timestamp));
        this.flush();
    }

    private patchXHR(request: XMLHttpRequest): void {
        const open: Function = request.open;
        const send: Function = request.send;
        const queue = this.queue;

        let xhrEvent: XHREvent;

        request.open = function(method: string, url: string): void {
            if (url.indexOf('localhost:0') < 0) {
                this._backtrace = {
                    method: method,
                    url: url
                };
            }

            return open.apply(this, arguments);
        };

        request.send = function(): void {
            if (!this._backtrace) {
                return send.apply(this, arguments);
            }

            let xhrEvent = new XHREvent(this._backtrace.method, this._backtrace.url);
            queue.add(xhrEvent);

            this.addEventListener('readystatechange', function(): void {
                if (this.readyState === 4) {
                    xhrEvent.duration = Date.now() - xhrEvent.timestamp;
                    xhrEvent.status = this.status === 1223 ? 204 : this.status;
                    xhrEvent.statusText = this.status === 1223 ? 'No Content' : this.statusText;
                    xhrEvent.contentLength = this.response.length;
                }
            }, true);

            return send.apply(this, arguments);
        };
    }

    private patchConsole(): void {
        const methods: string[] = ['log', 'debug', 'info', 'warn', 'error'];
        const queue = this.queue;

        for (let i: number = 0; i < methods.length; ++i) {
            let origMethod: Function = window.console[methods[i]];

            window.console[methods[i]] = function() {
                queue.add(new ConsoleEvent(methods[i], arguments));
                origMethod.apply(this, arguments);
            }
        }
    }

    private getTarget(event: MouseEvent | FocusEvent): Element {
        if (event instanceof MouseEvent) {
            return <Element>event.target || document.elementFromPoint(event.clientX, event.clientY);
        }

        return <Element>event.target;
    }

    private isElement(element: Element, tagName: string): boolean {
        if (!element || !element.tagName || element.tagName.toLowerCase() !== tagName.toLowerCase()) {
            return false;
        }

        return true;
    }
}

interface ITarget {
    tag: string;
    attributes: IKeyValueStore;
    text?: string;
    value?: {
        length: number;
        pattern: string;
    };
}

class BaseEvent {
    public type: string;
    public timestamp: number;
    public location: string;

    public constructor(type: string, timestamp: number = Date.now(), includeLocation: boolean = true) {
        this.type = type;
        this.timestamp = timestamp;

        if (includeLocation) {
            this.location = location.href;
        }
    }

    protected getAttributes(element: Element) {
        let attrs: IKeyValueStore = {};
        let attr: Attr;

        for (let i = 0; i < element.attributes.length; ++i) {
            attr = element.attributes.item(i);
            attrs[attr.name] = attr.nodeValue;
        }

        return attrs;
    }
}

class CustomEvent extends BaseEvent {
    public constructor(event: any, includeLocation?: boolean) {
        super(event.type || 'custom', undefined, includeLocation);

        for (let attr in event) {
            if (event[attr] !== 'type' && event[attr] !== 'timestamp' && event[attr] !== 'location') {
                this[attr] = event[attr];
            }
        }
    }
}

class ClickEvent extends BaseEvent {
    public target: ITarget;

    public constructor(element: Element, timestamp?: number) {
        super('click', timestamp);

        this.target = {
            tag: element.tagName.toLowerCase(),
            text: element.textContent.replace(/[\s\n]+/g, ' ').trim(),
            attributes: this.getAttributes(element)
        };
    }
}

class InputEvent extends BaseEvent {
    public target: ITarget;

    public constructor(element: HTMLInputElement, timestamp?: number) {
        super('input', timestamp);

        this.target = {
            tag: element.tagName.toLowerCase(),
            value: element.type === 'password' ? null : {
                length: element.value.length,
                pattern: this.valueType(element.value)
            },
            attributes: this.getAttributes(element)
        };
    }

    private valueType(value: string): string {
        const email = /^[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
        const date = /^(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[012])[\/\-]\d{4}$|^(\d{4}[\/\-](0?[1-9]|1[012])[\/\-]0?[1-9]|[12][0-9]|3[01])$/;
        const whitespace = /^\s*$/;
        const numeric = /^\d*$/;
        const alpha = /^[a-zA-Z]*$/;
        const alphanumeric = /^[a-zA-Z0-9]*$/;

        return value === '' ? 'empty' : 
            email.test(value) ? 'email' : 
            date.test(value) ? 'date' : 
            whitespace.test(value) ? 'whitespace' : 
            numeric.test(value) ? 'numeric' : 
            alpha.test(value) ? 'alpha' : 
            alphanumeric.test(value) ? 'alphanumeric' : 'characters'
    }
}

class BErrorEvent extends BaseEvent {
    public line: number;
    public column: number;
    public filename: string;
    public message: string;
    public stack: string;

    public constructor(error: ErrorEvent, timestamp?: number) {
        super('error', timestamp);

        this.line = error.lineno;
        this.column = error.colno;
        this.filename = error.filename;
        this.message = error.error.message;
        this.stack = error.error.stack;
    }
}

class XHREvent extends BaseEvent {
    public method: string;
    public url: string;
    public duration: number;
    public status: number;
    public statusText: string;
    public contentLength: number;

    public constructor(method: string, url: string) {
        super('xhr');
        this.method = method;
        this.url = url;
    }
}

class ConsoleEvent extends BaseEvent {
    public severity: string;
    public message: string;

    public constructor(severity: string, args: any) {
        super('console');
        this.severity = severity;
        this.message = JSON.stringify(Array.prototype.slice.call(args));
    }
}

export interface IBacktrace {
    /**
     * Get Backtrace version
     */
    version: string;

    /**
     * Add metadata to events
     * @param {string} key Key of data
     * @param {*} data Data
     */
    addMetadata(key: string, data: any): void;

    /**
     * Retrieve metadata
     * @param {string} key Key of data
     */
    getMetadata(key: string): any;

    /**
     * Push a custom event to the message queue
     * @param {*} event Event data
     * @param {boolean} includeLocation Set location to current uri
     */
    custom(event: any, includeLocation?: boolean): void;
}

const bt = new Backtrace();

export const backtrace: IBacktrace = {
    version: Backtrace.VERSION,
    addMetadata: bt.metadata.set.bind(bt.metadata),
    getMetadata: bt.metadata.get.bind(bt.metadata),
    custom: bt.custom.bind(bt)
};
