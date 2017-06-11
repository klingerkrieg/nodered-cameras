/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lucashiagod@gmail.com
 * Plugin do node-red
 */
var urlToServer;
var portForStream = 1337;
var portForRTSP = 1338;
var node;
var msg;
var html = "";
var rtspInterval;
//vai salvar o server e ultimo scaneamento no context
var globalContext;

const fs = require('fs');
const exec = require('child_process');
const startStream = require('./stream').startStream;
	

module.exports = function(RED) {
    function CameraStream(config) {
        RED.nodes.createNode(this,config);
        node = this;

		globalContext = node.context().global;

		
        this.on('input', function(msgParam) {
			//salva o obj msg
			msg = msgParam;
			try {
				msg = startStream(msg.hosts, msg, globalContext);
				node.send(msg);
			} catch (error) {
				console.log("***Erro total em cameraStream***");
				console.log(error);
				msgParam.payload = "Falha, tente novamente.";
				node.send(msgParam);
			}
        });
    }
    RED.nodes.registerType("Cam Stream",CameraStream);
}
