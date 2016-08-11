declare var backtrace: Backtrace;

interface Backtrace {
    /**
     * Backtrace version
     */
    version: string;

    /**
     * Configuration methods for Backtrace
     */
    configure: IConfigure;

    /**
     * Metadata management for all Backtrace events
     */
    metadata: IMetadata;

    /**
     * Manipulate events
     */
    events: IEvents;
}

interface IMetadata {
    /**
     * Add metadata to all events
     * @param {string} key The unique key for the metadata
     * @param {*} value Metadata value
     */
    add(key: string, value: any): void;

    /**
     * Retrieve a specific metadata value from its key
     * @param {string} key The unique key for the metadata
     */
    get(key: string): any;

    /**
     * Remove metadata from all events
     * @param {string} key The unique key for the metadata
     */
    remove(key: string): void;

    /**
     * List all metadata
     */
    list(): any;
}

interface IConfigure {
    /**
     * Set the URL for upload of event data
     * @param {string} url Full URL to a capture endpoint
     */
    setCaptureUrl(url: string): void;

    /**
     * Enable to upload all events in the queue at regular intervals
     * @param {number} [interval=10000] Interval in milliseconds
     */
    enableInterval(interval?: number): void;

    /**
     * Disable periodic upload of the event queue
     */
    disableInterval(): void;
}

interface IEvents {
    /**
     * Push a custom event to the event queue
     * @param {string} type Event type
     * @param {boolean} includeLocation Add current location to data
     * @param {*} data Arbitrary data
     */
    push(type: string, includeLocation?: boolean, data?: Object): void;

    /**
     * Push a custom event to the event queue
     * @param {string} type Event type
     * @param {*} data Arbitrary data
     */
    push(type: string, data?: Object): void;
}

export = backtrace;
