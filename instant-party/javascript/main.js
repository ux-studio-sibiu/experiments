
var gif_urls = [{ url: " ", dur: '4'}];


//User Configurations
var config_default_gif_dur = 3;
var mp3_urls = [];

window.random = "";
window.random_preloader = "0";
window.current_gif_dur = "4";



$(document).ready(function () {

    getFolderContents();

    $("#mp3_list_toggle").click(function (event) {
        $(this).toggleClass("active");
        $("#mp3_list").toggleClass("active");
    });


    $(document).keypress(function (event) {
        if (event.which == 32) {//key 32: space
            event.preventDefault();
            $('body').toggleClass("fullscreen")

        }

        if (event.which == 27) {//key 27: esc
            event.preventDefault();
            $('body').removeClass("fullscreen")
        }

    });


})//end of $(document).ready()



//functions

function getFolderContents() {

    $.ajax({
        url: "AUDIO.html",
        success: function (data) {

            $(data).find("a:contains(.mp3)").each(function (i) {
                // will loop through
                var current_url = $(this).attr("href").split('/');
                var clean_url = decodeURIComponent(current_url[current_url.length - 1]);
                mp3_urls.push(clean_url);

                //populate player list
                li_elem = $("<li />");
                a_link = $("<a />", {
                    href: "AUDIO/" + clean_url,
                    text: clean_url.replace(".mp3", "")
                });

                a_link.appendTo(li_elem);
                li_elem.appendTo("ul#mp3_list");

                //add click event
                $("ul#mp3_list a").on("click",
                function (event) {
                    event.preventDefault();
                    var url = $(this).attr("href");


                    $("#mp3_list_toggle").removeClass("active");
                    $("#mp3_list").removeClass("active");

                    start_mp3(url);

                });


            });//end of .each();

            startOffAir();

            }
    });

    $.ajax({
        url: "VISUALS.html",
        success: function (data) {
            $(data).find("a:contains(.gif)").each(function (i) {
                // will loop through
                var current_url = $(this).attr("href").split('/');
                var clean_url = decodeURIComponent(current_url[current_url.length - 1]);


                var aux_gif_obj = {
                    url: clean_url,
                    dur: isNaN(parseInt(clean_url.split("_")[1])) ? config_default_gif_dur : parseInt(clean_url.split("_")[1])
                };


                gif_urls[i] = aux_gif_obj;

            });

            window.random_preloader = Math.floor(Math.random() * Object.keys(gif_urls).length);
            $("#preload-01").css("background-image", "url('VISUALS/" + gif_urls[window.random_preloader].url + "')")
        }
    });

}

function next_gif() {

    window.random = random_preloader;
    window.random_preloader = Math.floor(Math.random() * Object.keys(gif_urls).length);

    $(".gif").css("background-image", "url('VISUALS/" + gif_urls[window.random].url + "')");
    $("#preload-01").css("background-image", "url('VISUALS/" + gif_urls[window.random_preloader].url + "')");


    return gif_urls[window.random].dur;


}

function start_random_mp3() {

    var params = new URLSearchParams(window.location.search);
    var curatedMp3s = [56,45,20,13,6,27,33];
    var random_audio = params.has('curated')
        ? curatedMp3s[Math.floor(Math.random() * curatedMp3s.length)]
        : Math.floor(Math.random() * mp3_urls.length);

    audio_player.src = "";
    audio_player.src = "AUDIO/" + mp3_urls[random_audio];
    audio_player.play();
}

function start_mp3(url) {
    audio_player.src = url;
    audio_player.play();
}

function startOffAir(){

    //start random song when current one ends;
    $("#audio_player").bind('ended', function () {
        start_random_mp3();
    });

    var timer;
    (function repeat() {
        current_dur = next_gif() * 1000;
        timer = setTimeout(repeat, current_dur);
    })();

};

function startTv(){
    start_random_mp3();
    $(".gif").show();
    $(".play-button").hide();
    $(".stop-button").show();
}

function stopTv(){
    audio_player.pause();
    $(".gif").hide();
    $(".stop-button").hide();
    $(".play-button").show();
}


window.addEventListener("wheel", e => {
  e.preventDefault();
  window.parent.postMessage({ type: "scroll", deltaY: e.deltaY }, "*");
}, { passive: false });
