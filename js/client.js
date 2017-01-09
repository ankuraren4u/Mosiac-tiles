// Edit me. Feel free to create additional .js files.

/* Object for Storing Coordinates */
function Coordinates(x, y)
{
    this.x = x;
    this.y = y;
}

function memoize(func) {
  var memo = {};
  var slice = Array.prototype.slice;

  return function() {
    var memoString = slice.call(JSON.stringify(arguments));
    var args = slice.call(arguments);
    if (memoString in memo)
      return memo[memoString];
    else
      return (memo[memoString] = func.apply(this, args));

  }
}

var ImageHelper = {
    /* Function agrumgents : { sourceImage : image object, tileSize : Coordinates object } 
       returns 2d array for average tile colors
    */
    averageTileColor : function(sourceImage, tileSize){
        var returnColors = [], rgb = {},
            tileHeight, tileWidth,
            
            //Variables for average color.
            x, y, i, j, x1, y1,
            pixelInterval = 1, // Configurable to skip pixels for finding tile color(average)
            pixelCount = 0,
            data, length,
            //Canvas element for drawing the image for finding average color of a tile
            canvas = document.createElement("canvas"),
            graphics = canvas.getContext("2d"), i ,j;
        
        //Draw source image on the canvas    
        canvas.height = sourceImage.height;
        canvas.width = sourceImage.width;

        //Draw full image to get rgb values for every pixel
        graphics.drawImage
        (
            sourceImage,
            0, 0
        );


        try {
            data = graphics.getImageData(0, 0, sourceImage.width, sourceImage.height);
        } catch(e) {
            alert(e);
            return {r:102,g:102,b:102};
        }

        data = data.data;
        length = data.length;

         /* Finding average color for tile starts */ 
        for (y = 0, i=0; y < sourceImage.height; y = y+ tileSize.y, i++)
        {
            returnColors[i] = [];   
            
            if(y+ tileSize.y > sourceImage.height) {
                tileHeight = sourceImage.height - y;
            } else {
                tileHeight = tileSize.y
            }

            for (x = 0, j=0; x < sourceImage.width; x = x+ tileSize.x, j++)
            {   
                if(x+ tileSize.x > sourceImage.width) {
                    tileWidth = sourceImage.width - x;
                } else {
                    tileWidth = tileSize.x;
                }

                                     
                pixelCount = 0; 
                rgb = {r:0,g:0,b:0}; 
                for(y1 = y; y1 < y + tileHeight; y1++) {
                    for(x1 = x; x1 < x + tileWidth; x1++) {
                        pixelCount++;
                        rgb.r += data[(sourceImage.width * y1+ x1)*4];
                        rgb.g += data[(sourceImage.width * y1+ x1)*4 + 1];
                        rgb.b += data[(sourceImage.width * y1 + x1)*4 + 2];
                    }
                }
                // floor the average values to give correct rgb values (ie: round number values)
                rgb.r = Math.floor(rgb.r/pixelCount);
                rgb.g = Math.floor(rgb.g/pixelCount);
                rgb.b = Math.floor(rgb.b/pixelCount);

                returnColors[i][j] = rgb
            }
             /* Finding average color for tile ends */
        }
 

        return returnColors;
    },

    /* Function agrumgents : { r : value, g: value, b: value } 
       returns promise for the ajax call for svg image.
    */
    generateTileFromColor : (function() {
        var queue = [], currentRequests = 0 ;

        var ajaxFunction = function(rgb, promiseResolve, promiseReject) {
            var xmlhttp = new XMLHttpRequest(), obj;
            currentRequests++;
            xmlhttp.onreadystatechange = function() {
                if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
                    currentRequests--;
                    if(queue.length && currentRequests < MAX_PARALLEL_REQUEST) {
                        obj = queue.shift();
                        ajaxFunction(obj.rgb, obj.promiseResolve, obj.promiseReject);
                    }

                    if (xmlhttp.status == 200) {
                        promiseResolve(xmlhttp.responseText);
                    }
                    else if (xmlhttp.status == 400) {
                        promiseReject('There was an error 400');
                    }
                    else {
                       promiseReject('something else other than 200 was returned');
                    }
                }
            };
            xmlhttp.open("GET", "/color/"+("0" + Number(rgb.r).toString(16)).substr(-2)+("0" + Number(rgb.g).toString(16)).substr(-2)+("0" +Number(rgb.b).toString(16)).substr(-2), true);
            xmlhttp.send();
        }

        return memoize(function(rgb) {
            if(currentRequests > MAX_PARALLEL_REQUEST) {
                return new Promise(function(resolve, reject) {
                    queue.push({
                        rgb: rgb,
                        promiseResolve : resolve,
                        promiseReject : reject
                    })
                });
            } else {
                return new Promise(function(resolve, reject) {
                    ajaxFunction(rgb, resolve, reject)    
                });
            }
        })
    })(),

    /* Function arguments  {tileColors : 2d array of {r:value, g:value, b:value}}
        Manipulates dom and and svgs to dom for creating composition of tiles.
    */
    compositeTilesFromColors: function(tileColors, domElement) {
        var _that = this, i, j, dfd = [], allDfds = [],  rows = [], currentRenderPos = 0, rowDOMElement, loaderElements; 
        
        domElement.innerHTML = null;
        if(tileColors && tileColors.length){
            domElement.style.width = (tileColors[0].length * TILE_WIDTH) + 'px';
            domElement.style.height = (tileColors.length * TILE_HEIGHT) + 'px';
        }

        return new Promise(function(resolve, reject) {
            for(i=0;i<tileColors.length;i++) {
                dfd = [];
                for(j=0;j<tileColors[i].length;j++) {
                    dfd[j] = _that.generateTileFromColor(tileColors[i][j])
                    allDfds.push(dfd[j]);
                }
                (function(i) {
                    Promise.all(dfd).then(function(values) {
                        var curr = i
                        rowDOMElement = document.createElement("div");
                        rowDOMElement.style.width = (tileColors[0].length * TILE_WIDTH) + 'px';
                        rowDOMElement.style.height = TILE_HEIGHT + 'px';

                        rowDOMElement.innerHTML = values.join("");
                        rows[i] = rowDOMElement
                        while(rows[currentRenderPos]) {
                            if(currentRenderPos === 0) {
                                loaderElements = document.getElementsByClassName('js-loader');
                                if(loaderElements && loaderElements.length) {
                                    loaderElements[0].style.display = 'none'
                                }
                            }
                            domElement.appendChild(rows[currentRenderPos]);
                            currentRenderPos++;
                        };
                    });    
                })(i);
            }

            Promise.all(allDfds).then(function(values) {
                resolve("done");
            }, function(values) {
                reject(values)
            });
        });
    }
}

var dragNdrop = (function() {
    var documentEventListener = function(e) {
        e.stopPropagation();
        e.preventDefault();
        dropElement.style.display = "block";
        e.dataTransfer.dropEffect = 'copy';
    },
    elementEventListener = function(e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.dataTransfer.files; // Array of all files
        startConverting(files[0]);
        dropElement.style.display = "none";
    },
    dropElement = document.getElementsByClassName('js-imagedrop-message')[0];

    return {
        enable : function() {
            document.addEventListener('dragover', documentEventListener);
            dropElement.addEventListener('drop', elementEventListener);
        },
        disable: function() {
            document.removeEventListener('dragover', documentEventListener);
            dropElement.removeEventListener('drop', elementEventListener);
        }
    }
})();

function startConverting(file) {
    var reader = new FileReader();
        reader.readAsDataURL(file),
        
    reader.onload = function (e) {
        if(file.type.match('image.*')) {
            var loaderElements = document.getElementsByClassName('js-loader');
            if(loaderElements && loaderElements.length) {
                loaderElements[0].style.display = 'block'
            }
            var image = new Image();
            image.onload = function(e) {
                var tileColors = ImageHelper.averageTileColor(image, new Coordinates(TILE_WIDTH, TILE_HEIGHT));
                
                domElement = document.getElementsByClassName('image__right-inner')[0];
                //Disable filepicker and drag and drop till the image result loads
                dragNdrop.disable();
                document.getElementsByClassName("js-imagepicker")[0].disabled = true;
                
                ImageHelper.compositeTilesFromColors(tileColors, domElement).then(function(value) {
                    dragNdrop.enable();
                    document.getElementsByClassName("js-imagepicker")[0].disabled = false;
                });
            }
            image.src = e.target.result;
            document.getElementsByClassName('image__left')[0].innerHTML = null
            document.getElementsByClassName('image__right-inner')[0].innerHTML = null
            document.getElementsByClassName('image__left')[0].appendChild(image);      
        } else {
            alert("Invalid file type");
        }  
    }     
};

function init() {
        
    document.addEventListener( 'change', function ( e ) {
        if(e.target.className.split(' ').indexOf( 'js-imagepicker' ) > -1)  {
            if (e.target.files && e.target.files[0]) {
                startConverting(e.target.files[0]);
            }
        }  
    }, false );

    dragNdrop.enable();
}

init();
    