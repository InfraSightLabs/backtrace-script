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
    private captureUrl = null;
    private dependencies: IKeyValueStore;
    private uuid: string;

    public constructor(metadata: Metadata) {
        this.metadata = metadata;
        this.queue = [];
        this.dependencies = this.getDependencies();
        this.uuid = this.generateUuid();
    }

    public setCaptureUrl(url: string): void {
        this.captureUrl = url;
    }

    public add(message: BaseEvent): BaseEvent {
        if (message instanceof XHREvent && message.type === 'xhr' && message.url === this.captureUrl) {
            return null;
        }

        this.queue.push(message);
        return message;
    }

    public send(): void {
        if (this.queue.length === 0 || !this.captureUrl) {
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
    public static VERSION = '0.0.4';
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

    public setCaptureUrl(url: string): void {
        this.queue.setCaptureUrl(url);
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

    /**
     * Set the URL for upload of event data
     * @param {string} url Full URL to a capture endpoint
     */
    setCaptureUrl(url: string): void;
}

const bt = new Backtrace();

export const backtrace: IBacktrace = {
    version: Backtrace.VERSION,
    addMetadata: bt.metadata.set.bind(bt.metadata),
    getMetadata: bt.metadata.get.bind(bt.metadata),
    custom: bt.custom.bind(bt),
    setCaptureUrl: bt.setCaptureUrl.bind(bt)
};
