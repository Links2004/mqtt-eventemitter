'use strict'

const mqtt_ee = require('../');
// const mqtt_ee = require('mqtt-eventemitter');

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

// second client (can be a separtate nodejs process)
mqtt_ee(mqtt_server_url).then(function init(node) {
    // MQTT topic foo/bar
    node.on('foo::bar', function(arg1, cb){
        console.log('arg1', arg1);
        cb(new Date())
    });
});
