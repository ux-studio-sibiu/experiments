var loadedFrames = [1,0,0,  0,0,0, 0,0,0];



function dDim(){   /* dinamicly dimensioning some elements  */
    
    
   var  lungime_sus=0,
        lungime_jos=0,
        
        // imgH = $(".project_img").height(),  
        
        winWidth = $(window).innerWidth(),
        winHeight = $(window).innerHeight(),
        frameMarginRight = 100;
        
   

   



// dimensionarea exacta a submeniului
    
    var lungime_nav_prj =0,
        inaltime_nav_prj=0,
        padding_nav=parseInt( $(".nav_elem").css("margin-right"));
        
    $(".nav_elem").each(   function(){lungime_nav_prj +=$(this).outerWidth(true);});
    $(".nav_projects").css( "width" , lungime_nav_prj - padding_nav );
    
    
    // apare si dispare console_bottom
    if(winHeight<800) {$("#console_bottom").css("display", "none"); $(".project_img").css("margin-top", 15); $("#handle_frame").css("bottom",0);}
    else              {$("#console_bottom").css("display", "block");$(".project_img").css("margin-top", 0);  $("#handle_frame").css({})} //"bottom":"calc(50% - 361px)"





///// FRAME 0
   
   
    // latimea pentru ultimul element de jos 
    
        
    $("div#frame0 .sus").each(   function(){lungime_sus +=$(this).outerWidth(true);});
    $("div#frame0 .jos").each(   function(){lungime_jos +=$(this).outerWidth(true);});
      
    var lungime_jos_ultimul = lungime_sus - lungime_jos - parseInt (    $("#jos_ultimul").css('margin-left')    ) - parseInt(    $("#jos_ultimul").css('margin-right')    ),
        lungime_titlu = $("#container_titlu").innerWidth();
    
    $("#jos_ultimul").css("width", lungime_jos_ultimul); 
      
      
    // pozitia centrata a copertei
    var variableDivWidth = (   $(window).outerWidth() -   lungime_titlu   )/2 + 5 ;
   
    if(variableDivWidth <0) variableDivWidth = 0;
    $(".spacer_flex").css( "width" , variableDivWidth );
    
    $("#wrapper_oriz_0").css( "width" ,   lungime_sus + lungime_titlu + 2*variableDivWidth + 30 );
    
    


//// FRAME 2
var lungime_sus_2=0;

$("div#frame2 .sus").each(   function(){lungime_sus_2 +=$(this).outerWidth(true);});
$("#wrapper_oriz_2").css( "width" ,   lungime_sus_2 + lungime_titlu + 2*variableDivWidth + 30 );     


//// FRAME 7
var lungime_sus_7=0;

$("div#frame7 .sus").each(   function(){lungime_sus_7 +=$(this).outerWidth(true);});
$("#wrapper_oriz_7").css( "width" ,   lungime_sus_7 + lungime_titlu + 2*variableDivWidth + 30 );
    
   




    // pozitia pt .project_img
    
        $( ".project_img" ).each(function(){
        
        var imgW = $(this).outerWidth(true),
            imgMargin, total_width=0;
        
        $(this).parent().siblings().each(function(){
            total_width+= $(this).outerWidth(true);
            
        });
        
        
        
        // if(imgW>winWidth-200) imgMargin = winWidth/4;
        // else imgMargin = (winWidth-imgW)/2;
        
        // $(this).css("margin-left", imgMargin).css("margin-right", imgMargin);
        // $(this).parent().css( "width" , imgW + 2 * imgMargin );
        
        $(this).parent().parent().css( "width" , imgW + total_width + 30 + frameMarginRight);
        
        
        
        
        });

    
    
    //margins top si bottom pt vertcal frames aka: distanta intre randurile orizontale
        
        // Pad each row so it is exactly the window height: the rows slider
        // centres the active row, and anything shorter shows the rows above and
        // below. Measured per row, after the layout above has settled.
        
        $( ".vertical_frames" ).each(function () {
            var distV = Math.max(0, (winHeight - $(this).height()) / 2);
            $(this).css({ paddingTop: distV, paddingBottom: distV });
        });
        
        $("#scratch").css("margin-top", ( winHeight - 720 )/2 );





} 





function refreshPage() {
    
    dDim();
    }



function lazyLoadFrameContent(frameNum){
    
    
    
    if(frameNum!==0)
    
    $("div#frame"+frameNum+" .lazy").lazy(
        {bind: "event",
         delay: 0,
         effect: "show",
         effectTime: 0,
         
         });
    
    else{
    
    $("div#frame"+frameNum+" .lazy").lazy(
        {bind: "load",
        //  delay: 50,
         effect: "show",
         effectTime: 0,
          });
             
             
             
             
         
    lazyLoadFrameCover(1);   }
         
    
   
    // alert("loaded frame content"+ frameNum);
    
    
    
}




function lazyLoadFrameCover(frameNum){
    

   
    if(!isFrameLoaded(frameNum)){
    
    $("div#frame"+frameNum+" div#container_titlu .lazy").lazy({
        
        bind            : "event",
        delay: 0,
        effect: "show",
        effectTime: 0,
        
        });
        
        
    loadedFrames[frameNum]=1;
    
    // alert("loaded frame cover"+ frameNum);
   
}
}

function isFrameLoaded(frameNum){
    
    
    if (loadedFrames[frameNum]==1) return true;
    else return false;
    
    
}







/* CODU  */

$(document).ready(function() { 
    
    
    var resizeTimer,
        horizontal_sly = [],
        prevFrame=0, nextFrame, currentFrame=0,
        winWidth = $(window).innerWidth();
    
    // alert(loadedFrames[0]);
        
        
    
    $(".fadeIntro").delay(100).fadeTo(1000,1);
    
    
    
    refreshPage();


    
    
    






////////////////////////////////                 ////////////////////////////////
    
    
var vertical_sly = new Sly('#the_main_frame',{
    


            horizontal: 0,
			itemNav: 'forceCentered',
			smart: 1,
			itemSelector: ".vertical_frames",
			activateMiddle: 1,
			mouseDragging: 1,
			touchDragging: 1,
			releaseSwing: 1,
			startAt: 0,
// 			scrollBar: $wrap.find('.scrollbar'),
			scrollBy: 0,
			speed: 200,
			elasticBounds: 1,
// 			easing: 'easeOutExpo',
			dragHandle: 1,
			dynamicHandle: 0,
			clickBar: 1,
			keyboardNavBy: "pages",
			


});

    

  
    
    

    
    
//////////////////////////////// frame0  ////////////////////////////////
    
    
 




$(window).resize(function () {   


    
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function(){
        
        winWidth = $(window).innerWidth();
        refreshPage();
        vertical_sly.reload();
        $(horizontal_sly).each(function () { this.reload(); });
        
        }, 400);
  
  });




    
    
//////////////////////////////////////////////////


for (var i=0; i<=7; i++){

horizontal_sly[i] = new Sly('#frame'+i,{
    
    horizontal:   true,
    itemNav:      null,
    scrollSource: "#frame"+i,
    scrollBy:     600, 
    
    mouseDragging: true,
    touchDragging: true,
    elasticBounds: true,
    releaseSwing: true,
       
   
    swingSpeed:   0.5,
    speed:        200,
    easing:        'swing',
    syncSpeed:     1,
    
    
    scrollBar:    "#hdl"+i,
    dragHandle:    true,    
	dynamicHandle: false,
	clickBar:      true,
	
});


horizontal_sly[i].init(); 

 



}


for(var i=8; i<=9;i++){

horizontal_sly[i] = new Sly('#frame'+i,{
    
    horizontal:   true,
    itemNav:      "forceCentered",
    scrollSource: "#frame"+i,
    scrollBy:     600, 
    
    mouseDragging: true,
    touchDragging: true,
    elasticBounds: true,
    releaseSwing: true,
       
   
    swingSpeed:   0.5,
    speed:        200,
    easing:        'swing',
    syncSpeed:     1,
    
    
    dragHandle:    true,    
	dynamicHandle: true,
	clickBar:      true,
	
});


horizontal_sly[i].init(); }






horizontal_sly[2].one("move", function(e) {
    
  $("#video1_container").html("<video width='938' height='670' controls poster='content/video/video1_cover.jpg'><source src='content/video/sponsors.mp4' type='video/mp4'></video>"); 
  $("#video2_container").html("<video width='938' height='670' controls poster='content/video/video2_cover.jpg'><source src='content/video/down.mp4' type='video/mp4'></video>"); 


// $("#iframe_container").html("<iframe width='938' height='670' src='//www.youtube.com/embed/h14C8V2LadE' frameborder='0' allowfullscreen></iframe>");
});





$(document).keydown(function(e) {
    
    
    // alert(e.keyCode);
    if(e.keyCode == 39)horizontal_sly[currentFrame].slideBy(winWidth/1.4);   //d
    if(e.keyCode == 37)horizontal_sly[currentFrame].slideBy(-winWidth/1.4);  //a
    
});



// load next i+1 frame


vertical_sly.on('active', function(e,i) {
        
                //  alert(i);
                
                if(i==0) $("#onoff").addClass("onoff");
                else     $("#onoff").removeClass("onoff");
                
                // $(".handle_frame").hide();
                
                
                
                
                prevFrame = currentFrame;
                currentFrame = i;
                // (The row just left is reset in the moveEnd handler below, not here.)
                
                
                $(".handle_frame#hdl"+prevFrame).fadeOut(500);
                $(".handle_frame#hdl"+currentFrame).fadeIn(500);
                // $("#frame"+prevFrame).fadeTo(200, 0.7);
                
                lazyLoadFrameCover(i+1);
                
                // alert("left frame "+ prevFrame +" for "+ currentFrame);
                // horizontal_sly[i].one('move', function(e) {

                lazyLoadFrameContent(i);
    // });

});

// Once the rows slider has finished moving, every row that is not the current
// one goes back to its start, instantly. They are off screen by then, so the
// reset is never seen, and coming back to a row always starts from its left.
// (Resetting in the active handler above animated it in view as the slide
// began.)
vertical_sly.on('moveEnd', function () {
    var current = vertical_sly.rel.activeItem;
    $.each(horizontal_sly, function (k, row) {
        if (row && k !== current && row.pos.dest !== row.pos.start) row.toStart(undefined, true);
    });
});



    // The sliders, for js/row-scroll.js (wheel and arrows roll over to the
    // next or previous row at a row's ends).
    window.arhSly = { rows: vertical_sly, row: horizontal_sly };

    //setting up for anchor links #
    var url = window.location.href;
    var lastChar = parseInt(url[url.length - 1]);
    

    if (lastChar >= 0 && lastChar <= 7) { }
    else { lastChar = 0 };
    //alert(lastChar);
    
    vertical_sly.init();
    vertical_sly.activatePage(lastChar, "immediate");



// click pe obiecte cu data-tip activeaza pagina corespunzatoare

$("[data-tip]").click(function(){
    
    var page = $(this).attr("data-tip").replace(/\D/g,'');
    vertical_sly.activatePage(page);

})




$('.fancybox').fancybox({
                 padding : 0,
                  margin :  80,
                 closeBtn : false,
                // openEffect  : 'elastic',
                // overlayColor : '#900',
                // overlayOpacity : 0.3,
                // //overlayShow : false,
                
                 openEffect      : 'fade',
                 closeEffect     : 'fade',
                 nextEffect      : 'elastic',  
                 prevEffect      : 'elastic', 
                
                
                helpers : { 
                    overlay: {css: { 
                   'overflow' : 'hidden'
                } }, 
                // overlay 
                            title:   { type: "outside"}
                            
                            }, // helpers

                tpl: {
                        next: '<a title="" class="fancybox-nav fancybox-next" href="javascript:;"><span>    <div><img  src="content/images/Backgrounds/arrow_right.png"></div>   </span></a>',
                        prev: '<a title="" class="fancybox-nav fancybox-prev" href="javascript:;"><span>    <div><img  src="content/images/Backgrounds/arrow_left.png"></div>   </span></a>'   
                        }
                
                
});






}) /////ducument ready






