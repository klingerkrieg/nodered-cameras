
const exec = require('child_process');



function verificaNmap(){
    try {
	    stdout = exec.execSync("nmap -h").toString();
    } catch (err) {
        stdout = "falha";
    }
    if (stdout.toLowerCase().indexOf("nmap") == 0){
        return true;
    } else {
        return false;
    }
}

function verificaFFMPEG(){
    try {
	    stdout = exec.execSync("ffmpeg -h", {stdio:'pipe'}).toString();
    } catch (err) {
        stdout = "falha";
    }
    if (stdout.toLowerCase().indexOf("usage: ffmpeg") > 0){
        return true;
    } else {
        return false;
    }
}

function check(){
    console.log("Verificando dependencias");
    dep = []
    dep.nmap = verificaNmap();
    dep.ffmpeg = verificaFFMPEG();
    return dep;
}


module.exports = {
  check: check
};

