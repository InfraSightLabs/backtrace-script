/*
MIT License

Copyright (c) 2016 Fredrik Ullner <fredrik.ullner@infrasightlabs.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

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

    /**
     * Immediately upload all events in the queue
     */
    flush(): void;
}

export = backtrace;
