
const exec = require('child_process');



function verificaNmap(){
	stdout = exec.execSync("nmap -h").toString();
    if (stdout.toLowerCase().indexOf("nmap") == 0){
        return true;
    } else {
        return false;
    }
}

function verificaFFMPEG(){
	stdout = exec.execSync("ffmpeg -h").toString();
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
  check: function () {
    return check();
}};
