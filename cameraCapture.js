/**
 * Autores:Alan Klinger klingerkrieg@gmail.com
 * 		   Lucas Dantas lucashiagod@gmail.com
 * Plugin do node-red
 */
var node;
var msg;
var captureInterval;

const startCapture = require('./capture').startCapture;

module.exports = function(RED) {
    function CameraCaptureNode(config) {
        RED.nodes.createNode(this,config);
        node = this;

		globalContext = node.context().global;


		globalContext.set("capturePath",config.capturePath);
		if (globalContext.get("capturePath").trim() == ""){
			globalContext.set("capturePath","./captures");
		}
		
		
        this.on('input', function(msgParam) {
			try {
				startCapture(msgParam.hosts, globalContext);
				node.send(msgParam);
			} catch (error) {
				console.log("***Erro total em cameraCapture***");
				console.log(error);
				msgParam.payload = "Falha, tente novamente.";
				node.send(msgParam);

			}
			
        });
    }
    RED.nodes.registerType("Cam Save on disk",CameraCaptureNode);
}
