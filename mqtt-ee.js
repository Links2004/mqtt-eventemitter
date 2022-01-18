'use strict'

const mqtt = require('mqtt');
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const crypto = require('crypto');

function md5(data) {
    return crypto.createHash('md5').update(data).digest("hex");
}

module.exports = async function (mqtt_url, mqtt_options) {
    const prefix_callback_topic = 'mqtt_ee_callback_topic_';
    const prefix_intern = 'mqtt_ee_intern';

    if (!mqtt_options) {
        mqtt_options = {};
    }

    if (!mqtt_options.clientId) {
        mqtt_options.clientId = 'mqtt_ee_' + Math.random().toString(16).substr(2, 6)
    }

    const clientId = mqtt_options.clientId;

    var callback_db = [];

    var eventRX = new EventEmitter2({
        wildcard: true,
        delimiter: '::',
        newListener: true,
        removeListener: true,
        maxListeners: 100,
        verboseMemoryLeak: true,
    });

    // convert from EventEmitter2 event name to MQTT topic
    function convert_name(name) {
        const s = name.split(eventRX.delimiter);
        var name_new_a = [];
        for (var i in s) {
            if (s[i] == '*') {
                name_new_a.push('+');
                continue;
            }
            name_new_a.push(s[i]);
        }
        return name_new_a.join('/');
    }

    // convert from MQTT topic to EventEmitter2 event name
    function convert_name_rev(name) {
        const s = name.split('/');
        var name_new_a = [];
        for (var i in s) {
            if (s[i] == '+') {
                name_new_a.push('*');
                continue;
            }
            name_new_a.push(s[i]);
        }
        return name_new_a.join(eventRX.delimiter);
    }

    function ison(name) {
        // no way to tell in MQTT currently, asume yes
        return true;
    }

    function handle_error(error) {
        // forward all errors to error event
        var args = ['error'];
        args = args.concat(Array.prototype.slice.call(arguments));
        if(args.length >= 2 && error) {
            eventRX.emit.apply(eventRX, args);
        }
    }

    function emit_event() {
        var args = Array.prototype.slice.call(arguments);
        // remove name from array
        var name = args.shift();
        for (var i in args) {
            // replace functions by callback reverence
            if (typeof args[i] === 'function') {
                var callback = args[i];
                const cbi = md5(name + '_' + i + '_' + Math.random());
                callback_db[cbi] = callback;
                args[i] = `${prefix_callback_topic}${prefix_intern}/${clientId}/event_callback/${cbi}`;
            }
        }

        var out;
        // dont use a array for 1 arg emits
        // this is to make it easy to use this lib with non mqtt-ee components
        if(args.length == 1) {
            out = args[0];
            if(typeof out !== 'string') {
                out = JSON.stringify(args[0]);
            }
        } else if(args.length >= 2) {
            out = JSON.stringify(args)
        }
        mqtt_client.publish(convert_name(name), out, handle_error);
    }

    function prepare_event(data) {
        var event = [];
        if (! Array.isArray(data)) {
            data = [data];
        }
        for (var i in data) {
            if (typeof data[i] === 'string') {
                // handle callback topics
                if (data[i].startsWith(prefix_callback_topic)) {
                    const callback_topic = data[i].substring(prefix_callback_topic.length);
                    event.push(function () {
                        var args = [convert_name_rev(callback_topic)];
                        args = args.concat(Array.prototype.slice.call(arguments));
                        emit_event.apply(null, args);
                    });
                    continue;
                }
            }
            // normal MQTT data
            event.push(data[i]);
        }
        return event;
    }

    const mqtt_client = mqtt.connect(mqtt_url, mqtt_options);

    mqtt_client.on('error', handle_error);

    eventRX.on('removeListener', function (name, cb) {
        if (eventRX.listeners(name).length <= 0) {
            mqtt_client.unsubscribe(convert_name(name), handle_error);
        }
    });

    eventRX.on('newListener', function (name, cb) {
        mqtt_client.subscribe(convert_name(name), handle_error);
    });

    mqtt_client.on('message', function (topic, message) {
        const event_name = convert_name_rev(topic);
        const s = event_name.split(eventRX.delimiter);
        const data = mqtt_client.msg_json(message, true);
        // mqtt-eventemitter internal messages
        if (s[0] == prefix_intern) {
            switch (s[2]) {
                case 'event_callback':
                    const callback_id = s[3];
                    var cb = callback_db[callback_id];
                    if (cb) {
                        var event = prepare_event(data);
                        cb.apply(null, event);
                        delete callback_db[callback_id];
                    } else {
                        handle_error('get callback for unknown ID?', callback_id);
                    }
                    break;
            }
        } else {
            // other MQTT topics
            var event = [event_name];
            event = event.concat(prepare_event(data));
            eventRX.emit.apply(eventRX, event);
        }
    });

    mqtt_client.on('connect', function() {
        mqtt_client.subscribe(`${prefix_intern}/${clientId}/event_callback/+`, handle_error);
    });

    // try to parse MQTT messages as JSON
    mqtt_client.msg_json = function msg_json(message, nowarn) {
        var msg = message.toString()
        try {
            if (msg != "") {
                msg = JSON.parse(message.toString());
            }
        } catch (e) {
            if (!nowarn) {
                handle_error('MQTT message JSON error', msg, e.toString())
            }
        }
        return msg;
    }

    var api = {
        emit: emit_event,
        on: function on(event, listener) {
            eventRX.on(event, listener);
        },
        off: function off(event, listener) {
            eventRX.off(event, listener);
        },
        onAny: function onAny(listener) {
            eventRX.onAny(listener);
        },
        offAny: function offAny(listener) {
            eventRX.offAny(listener);
        },
        once: function once(event, listener) {
            eventRX.once(event, listener);
        },
        many: function many(event, timesToListen, listener) {
            eventRX.many(event, timesToListen, listener);
        },
        ison: ison,
        hasListeners: ison,
        emitInterval: function emitInterval(event, ms, cb, nocheck) {
            eventRX.on(event + '::get', function (ccb) {
                cb(event)
                    .then(function (data) {
                        if (typeof ccb === 'function') ccb(data);
                    })
                    .catch(handle_error);
            });
            function run() {
                if (ison(event) || nocheck) {
                    cb(event)
                        .then(function (data) {
                            var args = [event];
                            args = args.concat(Array.prototype.slice.call(arguments));
                            emit_event.apply(null, args);
                        })
                        .catch(handle_error);
                }
            }
            var interval = setInterval(run, ms);
            run();
            return interval;
        },
        mqtt: mqtt_client
    };
    return api;
};