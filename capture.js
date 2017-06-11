const fs = require('fs');
const exec = require('child_process');
var captureInterval;

function startCapture(hosts, globalContext){
	console.log("Salvando em disco..");

	capturePath = globalContext.get("capturePath");
	

	//Captura
	//cria pasta
	if (!fs.existsSync(capturePath)){
		fs.mkdirSync(capturePath);
	}
	//Cria processos para salvar as cameras
	var totalSaved = hosts.length;
	clearInterval(captureInterval);
	captureInterval = setInterval(function(){
		//Controle para só salvar o proximo frame se todos os anteriores tiverem sido salvos
		//Para evitar muitos processos no server
		if (totalSaved < hosts.length){
			return;
		}
		totalSaved = 0;
		for (var i = 0; i < hosts.length; i++){
			host = hosts[i];
			
			path = capturePath+"/"+host.ip.replace(/\./g, '_')+"/";
			if (!fs.existsSync(path)){
				fs.mkdirSync(path);
			}
			url = host.protocol+"://"+host.ip+":"+host.port+host.path
			//salvar todas as cameras possiveis
			var dt = new Date();
			path += dt.toISOString().split(".")[0].replace(/[:]/g,"-")
			cmd = "ffmpeg -f mjpeg -i "+url+" -vframes 1 -updatefirst 1 "+path+ ".jpg -y";
			console.log(cmd);
			exec.exec(cmd, function(error, stdout, stderr) {
				totalSaved++;
			});
		}
		//verificar se esta conseguindo salvar, se nao conseguir mais ele deve parar de tentar
	},3000);
}



module.exports = {
  startCapture: startCapture
};

