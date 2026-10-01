
var gif_urls = [{ url: " ", dur: '4'}];
       

//User Configurations
var config_default_gif_dur = 3;
var mp3_urls = [];
var gifs_watched = 0;


var player;//,
var streaming_is_live = false;

//YT Player Options
var videoId = "iZ_Uer513hY"; //OFFLINE
var videoId = "EnBAXkBiJlc"; //LIVE
window.random = "";
window.random_preloader = "0";
window.current_gif_dur = "4";



$(document).ready(function () { 
       
    getFolderContents();

    //listen for knowstreamstatus event
    $(window).one('knowstreamstatus', function () {
        alert('status changed');

        stop_mp3();
        $(".gif").hide();
        $("#ytplayer").show();
    });

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
            //data = Server.UrlDecode(data)

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
                //var images = $(this).attr("href");

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

    if(gifs_watched == 5){
        embed_player();
    }
    gifs_watched++;

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

function stop_mp3() { audio_player.pause(); audio_player.src = ""; }

function onYouTubePlayerAPIReady() {

    player = new YT.Player('ytplayer', {
        height: '258',
        width: '422',
        videoId: 'videoId',
                


        playerVars: { 'autoplay': 1, 'controls': 0, 'autohide': 1, 'wmode': 'opaque' },


        events: {
            onStateChange: function () {
                streaming_is_live = true;

                //create the event: know stream status
                var evt = $.Event('knowstreamstatus');
                $(window).trigger(evt);
            }
            //onReady: function () {
                        
            //    setTimeout(function () {

            //        // 1 = playing // if playing has started //now we can check player.getDuration()
            //        if (player.getPlayerState() == 1 || player.getPlayerState() == 3) {
            //            streaming_is_live = (player.getDuration() == 0) ? false : true;

            //        }
            //        alert(streaming_is_live)

            //    }, 2000);
            //is_streaming = player.getDuration(); streamingOrNot()}
                    
                    
            //}
        }
    });



}

function startOffAir(){

    $("#ytplayer").hide();

    //start random song when current one ends;
    $("#audio_player").bind('ended', function () {
        start_random_mp3();
    });

    var timer;
    (function repeat() {
        //current_dur = 2000;
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

//startOffAir();


function embed_player() {
    // Load the IFrame Player API code asynchronously.
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/player_api?enablejsapi=1&version=3";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Replace the 'ytplayer' element with an <iframe> and
    // YouTube player after the API code downloads.
}


window.addEventListener("wheel", e => {
  e.preventDefault();
  window.parent.postMessage({ type: "scroll", deltaY: e.deltaY }, "*");
}, { passive: false });