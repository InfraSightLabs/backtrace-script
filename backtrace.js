(function(global, Backtrace) {
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = new Backtrace(global, undefined);
    } else {
        if (global.backtrace) {
            console.warn('Backtrace conflict');
            return;
        }

        var scripts = document.getElementsByTagName('script');
        var script = scripts[scripts.length - 1];
        var attribute = script.attributes.getNamedItem('data-capture-url');
        var url = attribute ? attribute.value : undefined;

        global.backtrace = new Backtrace(global, url);
    }
})(window, function(global, captureUrl) {
    var VERSION = '0.1.2';
    var INTERVAL = 10000;
    var metadata = {};
    var queue = [];
    var timer;
    var retriesCount = 0;

    var environment = {
        getDependencies: function() {
            dependencies = {
                backtrace: VERSION
            };

            var angular = global.angular;
            var jQuery = global.jQuery;

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

            for (var dep in global) {
                if (dep !== 'webkitStorageInfo' && dep !== 'webkitIndexedDB') { // && "top" !== a && "parent" !== a && "frameElement" !== a
                    try {
                        if (w[dep]) {
                            var version = w[dep].version || w[dep].Version || w[dep].VERSION;

                            if (typeof version === 'string') {
                                dependencies[dep] = version;
                            }
                        }
                    } catch (err) {}
                }
            }
            return dependencies;
        },
        generateUuid: function() {
            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(character) {
                var rand = 16 * Math.random() | 0;
                return (character === 'x' ? rand : (rand & 3 | 8)).toString(16)
            });
        },
        stripBaseUrl: function(url) {
            var pattern = /^https?:\/\/[a-z\:0-9.]+/i;
            var match = pattern.exec(url);

            if (match !== null && match[0].length > 0) {
                return url.replace(match[0], '');
            }

            return url;
        },
        getBaseUrl: function(url) {
            var pattern = /^https?:\/\/[a-z\:0-9.]+/i;
            var match = pattern.exec(url);

            if (match !== null && match[0].length > 0) {
                return match[0];
            }

            return url;
        }
    };

    var USERAGENT = navigator.userAgent;
    var UUID = environment.generateUuid();
    var DEPENDENCIES = environment.getDependencies();

    var send = function() {
        if (queue.length === 0) {
            return;
        }

        if (captureUrl === undefined) {
            console.warn('Backtrace requires a capture URL');
            clearInterval(timer); // Pause until a captureUrl is set
            return;
        }

        var request = new XMLHttpRequest();
        request.open('POST', captureUrl, true);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify({
            uploadTime: Date.now(),
            environment: {
                dependencies: DEPENDENCIES,
                uuid: UUID,
                useragent: USERAGENT,
                viewport: {
                    width: global.document.documentElement.clientWidth,
                    height: global.document.documentElement.clientHeight
                }
            },
            metadata: metadata,
            events: queue
        }));

        request.addEventListener('readystatechange', function() {
            if (request.readyState === 4) {
                if (request.status === 200) {
                    queue = [];

                    if (retriesCount) {
                        clearInterval(timer);
                        timer = setInterval(send, INTERVAL);
                        retriesCount = 0;
                    }
                } else {
                    if (retriesCount < 3) {
                        ++retriesCount;
                        clearInterval(timer);
                        timer = setInterval(send, INTERVAL * retriesCount);
                    }
                }
            }
        }, true);
    }

    var listener = {
        onError: function(event) {
            var timestamp = Date.now();
            queue.push({
                timestamp: Date.now(),
                type: 'error',
                location: environment.stripBaseUrl(location.href),
                line: event.lineno,
                column: event.colno,
                filename: environment.stripBaseUrl(event.filename),
                message: event.message,
                stack: event.stack
            });
            send();
        },
        onClick: function(event) {
            var timestamp = Date.now();
            var target = this.getTarget(event);

            if (this.isElement(target, 'a') || this.isElement(target, 'button')) {
                queue.push({
                    timestamp: Date.now(),
                    type: 'click',
                    location: environment.stripBaseUrl(location.href),
                    tag: target.tagName.toLowerCase(),
                    text: target.textContent.replace(/[\s\n]+/g, ' ').trim(),
                    attributes: this.getAttributes(target)
                });
            }
        },
        onBlur: function(event) {
            var timestamp = Date.now();
            var target = this.getTarget(event);

            if (this.isElement(target, 'input') || this.isElement(target, 'textarea')) {
                queue.push({
                    timestamp: Date.now(),
                    type: 'input',
                    location: environment.stripBaseUrl(location.href),
                    tag: target.tagName.toLowerCase(),
                    value: target.type === 'password' ? null : {
                        length: target.value.length,
                        pattern: this.valueType(target.value)
                    },
                    attributes: this.getAttributes(target)
                });
            }
        },
        patchConsole: function() {
            var methods = ['log', 'debug', 'info', 'warn', 'error'];

            for (var i = 0; i < methods.length; ++i) {
                (function(index) {
                    var origMethod = global.console[methods[i]];

                    global.console[methods[index]] = function() {
                        try {
                            var args = Array.prototype.slice.call(arguments);
                            queue.push({
                                timestamp: Date.now(),
                                type: 'console',
                                location: environment.stripBaseUrl(location.href),
                                severity: methods[index],
                                message: JSON.stringify(args)
                            });
                            origMethod.apply(this, args);
                        } catch (err) {
                            listener.onError(err);
                        }
                    }
                })(i);
            }
        },
        patchXHR: function(request) {
            var open = request.open;
            var send = request.send;

            request.open = function(method, url) {
                if (url.indexOf('localhost:0') < 0) {
                    this._backtrace = {
                        timestamp: Date.now(),
                        method: method,
                        url: url
                    };
                }

                return open.apply(this, arguments);
            };

            request.send = function() {
                try {
                    if (!this._backtrace) {
                        return send.apply(this, arguments);
                    }

                    var xhrEvent = {
                        timestamp: this._backtrace.timestamp,
                        type: 'xhr',
                        location: environment.stripBaseUrl(location.href),
                        method: this._backtrace.method,
                        url: this._backtrace.url
                    };
                    queue.push(xhrEvent);

                    this.addEventListener('readystatechange', function() {
                        if (this.readyState === 4) {
                            xhrEvent.duration = Date.now() - xhrEvent.timestamp;
                            xhrEvent.status = this.status === 1223 ? 204 : this.status;
                            xhrEvent.statusText = this.status === 1223 ? 'No Content' : this.statusText;
                            xhrEvent.contentLength = this.response.length;
                        }
                    }, true);
                } catch (err) {
                    listener.onError(err);
                }

                return send.apply(this, arguments);
            };
        },
        init: function() {
            global.addEventListener('click', this.onClick.bind(this), true);
            global.addEventListener('blur', this.onBlur.bind(this), true);
            global.addEventListener('error', this.onError.bind(this), true);

            this.patchXHR(XMLHttpRequest.prototype);
            this.patchConsole();
        },
        getTarget: function(event) {
            if (event instanceof MouseEvent) {
                return event.target || document.elementFromPoint(event.clientX, event.clientY);
            }

            return event.target;
        },
        isElement: function(element, tagName) {
            if (!element || !element.tagName || element.tagName.toLowerCase() !== tagName.toLowerCase()) {
                return false;
            }

            return true;
        },
        getAttributes: function(element) {
            var attrs = {};
            var attr;

            for (var i = 0; i < element.attributes.length; ++i) {
                attr = element.attributes.item(i);
                attrs[attr.name] = attr.nodeValue;
            }

            return attrs;
        },
        valueType: function(value) {
            var email = /^[a-z0-9!#$%&'*+=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
            var date = /^(0?[1-9]|[12][0-9]|3[01])[\/\-](0?[1-9]|1[012])[\/\-]\d{4}$|^(\d{4}[\/\-](0?[1-9]|1[012])[\/\-]0?[1-9]|[12][0-9]|3[01])$/;
            var whitespace = /^\s*$/;
            var numeric = /^\d*$/;
            var alpha = /^[a-zA-Z]*$/;
            var alphanumeric = /^[a-zA-Z0-9]*$/;

            return value === '' ? 'empty' : 
                email.test(value) ? 'email' : 
                date.test(value) ? 'date' : 
                whitespace.test(value) ? 'whitespace' : 
                numeric.test(value) ? 'numeric' : 
                alpha.test(value) ? 'alpha' : 
                alphanumeric.test(value) ? 'alphanumeric' : 'characters'
        }
    };

    listener.init();

    this.version = VERSION;

    this.configure = {
        setCaptureUrl: function(url) {
            captureUrl = url;
        },
        disableInterval: function() {
            clearInterval(timer);
        },
        enableInterval: function(interval) {
            if (interval !== undefined && typeof interval === 'number' && interval > 10000) {
                INTERVAL = interval;
            }

            clearInterval(timer);
            timer = setInterval(send, INTERVAL);
        }
    };

    this.metadata = {
        add: function(key, value) {
            metadata[key] = value;
        },
        get: function(key) {
            return metadata[key];
        },
        remove: function(key) {
            delete metadata[key];
        },
        list: function() {
            return metadata;
        }
    };

    this.events = {
        push: function(type, includeLocation, data) {
            if (!type) {
                return;
            }

            if (typeof includeLocation === 'object' && data === undefined) {
                data = includeLocation;
            }

            var event = {
                timestamp: Date.now(),
                type: type,
                location: environment.stripBaseUrl(location.href)
            };

            if (includeLocation === false) {
                delete event.location;
            }

            if (data) {
                for (var prop in data) {
                    if (data.hasOwnProperty(prop) && prop !== 'timestamp' && prop !== 'type' && prop !== 'name' && prop !== 'location') {
                        event[prop] = data[prop];
                    }
                }
            }

            queue.push(event);
        },
        flush: function() {
            send();
        }
    };
});
