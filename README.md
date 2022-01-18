# mqtt-eventemitter (mqtt-ee)
[![npm version](https://badge.fury.io/js/mqtt-eventemitter.svg)](https://www.npmjs.com/package/mqtt-eventemitter)

MQTT with EventEmitter API and callback support

#### Goal ####

using MQTT with a EventEmitter based API.
with out the need to handle subscribing.
and the addition of callback support to other mqtt-eventemitter clients.

#### examples ####

see: [examples dir](https://github.com/Links2004/mqtt-eventemitter/tree/master/examples)

##### simple events #####

```js
const mqtt_ee = require('mqtt-eventemitter');
const mqtt_server_url = 'mqtt://test.mosquitto.org';

// first client
mqtt_ee(mqtt_server_url).then(function init(node) {
    setInterval(function() {
        // MQTT topic foo/bar
        node.emit('foo::bar', 'arg1', new Date());
    }, 2000);
});
```

```js
const mqtt_ee = require('mqtt-eventemitter');
const mqtt_server_url = 'mqtt://test.mosquitto.org';
// second client
mqtt_ee(mqtt_server_url).then(function init(node) {
    // MQTT topic foo/bar
    node.on('foo::bar', function(arg1, date){
        console.log('arg1', arg1);
        console.log('date', date);
    });
});
```


##### callback events #####
```js
const mqtt_ee = require('mqtt-eventemitter');
const mqtt_server_url = 'mqtt://test.mosquitto.org';

// first client
mqtt_ee(mqtt_server_url).then(function init(node) {
    setInterval(function() {
        // MQTT topic foo/bar
        node.emit('foo::bar', 'arg1', function(date) {
            console.log('callback called with', date);
        });
    }, 2000);
});
```

```js
const mqtt_ee = require('mqtt-eventemitter');
const mqtt_server_url = 'mqtt://test.mosquitto.org';
// second client
mqtt_ee(mqtt_server_url).then(function init(node) {
    // MQTT topic foo/bar
    node.on('foo::bar', function(arg1, cb){
        console.log('arg1', arg1);
        cb(new Date())
    });
});
```