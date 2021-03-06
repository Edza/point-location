var fullPolygon = []; //A circular array of points
var polygonParts = [fullPolygon]; //Disjoint subsets of fullPolygon whose union is equal to fullPolygon
var fullPolygonIsComplete = false;
var currentPolygonSplitter = [];
//Invariant: if fullPolygonIsComplete == false, then polygonParts.length == 1

(function() {
  try{
    var q = jQuery;
  } catch(e) {
    alert("JQuery failed to load");
  }
})();

var canvas = $("#canvas");
var nextButton = $("#nextStepDataStructure");
var canvasPosition = {
    x: canvas.offset().left,
    y: canvas.offset().top
};

var mainTriangle = [new Point(0, canvas.height() - 2),
                    new Point(canvas.width() - 1, canvas.height() - 2),
                    new Point(canvas.width()/2, 0)];

function resetDataStructure() {
  nextButton = $("#nextStepDataStructure");
  $("#nextStepPointLocation").val("Build the data structure first")
                             .attr('disabled', 'disabled');
  $("#choosePoint").val("Build the data structure first")
                   .attr('disabled', 'disabled');
  $("#resetDataStructure").removeAttr('disabled')
                          .val("Rebuild data structure");

  render();
  setNextStep("Triangulate polygon", function() {
    logMessage("Triangulating each part of the polygon");
    var triangles = [];
    for(var i=0; i<polygonParts.length; i++) {
      triangles = triangles.concat(triangulate(polygonParts[i]));
    }
    canvas.clearCanvas();
    render();
    renderTriangulation(triangles, "gray");
    render(true);
    setNextStep("Triangulate outside of polygon", function() {
      logMessage("Triangulating between the polygon and the outer triangle");
      triangles = triangles.concat(trianglesOutsidePolygon(fullPolygon, mainTriangle));
      renderTriangulation(triangles, "gray");
      interactiveIndependentSetRemoval(triangles);
    });
  });
}

function startSplittingPolygon() {
  setCanvasOnClick(function (mouse) {
    var p = snapToPoint(mouse);
    var splitter = currentPolygonSplitter;

    var hitsAVertex = polygonParts.some(function (part) {
      return pointIsOnPolygon(p, part);
    });

    if(pointIsOnPolygon(p, splitter)) {
      logMessage("Polygon split cannot self-intersect", true);
    } else if(splitter.length == 0 && !hitsAVertex) {
      logMessage("Polygon split must start on a vertex", true);
    } else if(!hitsAVertex && !pointIsInsidePolygon(mouse, fullPolygon)) {
      logMessage("Polygon splits must remain within the main polygon", true);
    } else if(splitter.length === 0 || !segmentIntersectsAnyPolygon(new LineSegment(splitter[splitter.length - 1], p))) {
      splitter.push(p);
      render();
      var isFinishingSplit = hitsAVertex && splitter.length > 1;
      if(isFinishingSplit) {
        logMessage("Adding a split to the polygon");
        addPolygonSplit(splitter);
        currentPolygonSplitter = [];
        render();
      }
    } else {
      logMessage("Self intersecting segment. Ignoring.", true);
    }
  });
  setNextStep("Done splitting polygon", function() {
    logMessage("Done splitting the polygon");
    canvas.off('click');
    resetDataStructure();
  });
}


$(function() {
  render();

  $("#resetDataStructure").on('click', resetDataStructure);
});

var logMessage = null;
(function() {
  var log = $("#messageLog");
  var count = 0;
  logMessage = function(message, isError) {
    count++;
    var paragraph = $(document.createElement('p'));
    paragraph.text(count + ". " + message)
             .addClass("logMessage");
    if(isError) {
      paragraph.addClass("errorMessage");
    }
    log.append(paragraph);
    log.scrollTop(log[0].scrollHeight);
  };
})();

function setCanvasOnClick(callback) {
  canvas.off('click');
  canvas.on('click', function(e) {
    var mouse = new Point(e.pageX - canvasPosition.x, e.pageY - canvasPosition.y);
    callback(mouse);
  });
}

setCanvasOnClick(function(mouse) {
  if(pointIsInsidePolygon(mouse, mainTriangle)) {
    addPoint(mouse);
  } else {
    logMessage("Point is outside the main triangle", true);
  }
});

function setNextStep(text, callback) {
  if(callback) {
    nextButton.removeAttr('disabled');
    nextButton.val(text);
    nextButton.on('click', function() {
      nextButton.off('click');
      nextButton.attr('disabled', 'disabled');
      callback();
    });
    if($("#shouldAnimate").is(':checked')) {
      setTimeout(function() {
        if(nextButton.attr('disabled') != 'disabled') {
          nextButton.click();
        }
      }, 350);
    }
  } else {
    nextButton.attr('disabled', 'disabled');
  }
}

function addPoint(p) {
  p = snapToPoint(p);
  if(canAppendPointToPolygon(fullPolygon, p)) {
    fullPolygon.push(p);
    var isFinishingPolygon = fullPolygon.length >= 3 && p.equals(fullPolygon[0]);
    if(isFinishingPolygon) {
      logMessage("Finishing polygon");
      fullPolygonIsComplete = true;
      canvas.off('click'); //Disable clicks so that we don't get new points
      fullPolygon.forEach(function(p) {console.log("[" + p.x + "," + p.y + "],")})
      fullPolygon.pop();
      startSplittingPolygon();
      //resetDataStructure();
    }
    render();
  } else {
    logMessage("Self intersecting segment. Ignoring.", true);
  }
}

function interactiveIndependentSetRemoval(triangles) {
  var pointLocationData = [triangles.slice(0)];
  function continuousRemoval(triangles) {
    if(triangles.length > 1) {
      setNextStep("Find independent set", function() {
        var independentSet = removeNextIndependentSet(triangles, continuousRemoval);
        var graph = triangulationToGraph(triangles);
        pointLocationData.push(getNextTriangulationLevel(graph, independentSet));
      });
    } else {
      waitForPointLocationChoice(pointLocationData);
    }
  }
  continuousRemoval(triangles);
}

function waitForPointLocationChoice(pointLocationData) {
  $("#nextStepDataStructure").val("Done building the data structure")
                             .attr('disabled', 'disabled');
  nextButton = $("#nextStepPointLocation");
  nextButton.attr('disabled', 'disabled');

  var choosePointButton = $("#choosePoint");
  choosePointButton.off('click');
  choosePointButton.on('click', function() {
    waitForPointLocationChoice(pointLocationData);
  });
  choosePointButton.attr('disabled', 'disabled');

  logMessage("Waiting for a point to locate");

  nextButton.val("Choose a point to locate");
  choosePointButton.val("Choose a point to locate");
  render();
  setCanvasOnClick(function (mouse) {
    canvas.off('click');
    renderCircle(mouse, "green");
    choosePointButton.val("Reset point location");
    choosePointButton.removeAttr('disabled');
    nextButton.removeAttr('disabled');
    setNextStep("Locate the point", function() {
      interactivelyLocatePoint(pointLocationData, mouse);
    });
  });
}

function interactivelyLocatePoint(pointLocationData, query) {
  function renderCurrentTriangulation(allTriangles, emphasizedTriangles) {
    renderTriangulation(allTriangles, "gray");
    renderTriangulation(emphasizedTriangles, "blue");
    renderOuterTriangle();
    renderCircle(query, "green");
  }

  function lastStep() {
    var correctTriangle = null;
    var triangles = pointLocationData[0];
    for(var i=0; i<triangles.length; i++) {
      if(pointIsInsidePolygon(query, triangles[i])) {
        correctTriangle = triangles[i];
        break;
      }
    }
    console.assert(correctTriangle);
    //Find out which polygon this point belongs to. In a more real
    //implementation, there would be a map from the triangles to their owners.
    var correctPolygon = null;
    for(var i=0; i<polygonParts.length; i++) {
      if(pointIsInsidePolygon(query, polygonParts[i]))
        correctPolygon = polygonParts[i];
    }
    var fillColor = "Coral";
    canvas.clearCanvas();
    if(correctPolygon) {
      renderLine(correctPolygon, {
        closed: true,
        fillStyle: fillColor,
        strokeStyle: fillColor
      });
    } else if(pointIsInsidePolygon(query, mainTriangle)) {
      renderLine(mainTriangle, {
        closed: true,
        fillStyle: fillColor,
        strokeStyle: fillColor
      });
      renderLine(fullPolygon, {
        closed: true,
        strokeStyle: "white",
        fillStyle: "white"
      });
    }

    renderCurrentTriangulation(pointLocationData[0], [correctTriangle]);
    renderPolygons();
  }

  function nextLevel(level, overlappingTriangles, previousTriangle) {
    console.assert(level < pointLocationData.length);
    var triangles = pointLocationData[level];

    canvas.clearCanvas();
    renderLine(previousTriangle, {
      closed: true,
      fillStyle: "wheat",
      strokeStyle: "wheat"
    });
    renderCurrentTriangulation(triangles, overlappingTriangles);

    var nextOverlaps = null;
    for(var i=0; i<triangles.length; i++) {
      if(pointIsInsidePolygon(query, triangles[i])) {
        nextOverlaps = triangles[i].overlaps;
        previousTriangle = triangles[i];
        break;
      }
    }

    if(nextOverlaps === null) {
      logMessage("The point was not found");
    } else if(level < 1) {
      setNextStep("Last step: Find the polygon", lastStep);
    } else {
      setNextStep("Next level", function() {
        nextLevel(level - 1, nextOverlaps, previousTriangle);
      });
    }
  }
  nextLevel(pointLocationData.length - 1, [], []);
}

function renderGraphWithoutPoints(graph, badpoints, color) {
  var badPointsSet = {};
  for(var i=0; i<badpoints.length; i++) {
    badPointsSet[badpoints[i].hash()] = true;
  }

  function isBadPoint(p) {
    return badPointsSet[p.hash()] === true;
  }

  $.each(graph, function (key, node) {
    if(isBadPoint(node.p)) {
      return;
    }
    for(var i=0; i<node.neighbors.length; i++) {
      var p = node.neighbors[i];
      if(!isBadPoint(p)) {
        renderLine([p, node.p], {
          strokeStyle: color
        });
      }
    }
    renderCircle(node.p, "black");
  });
  renderOuterTriangle();
}

function removeNextIndependentSet(triangles, callback) {
  var graph = triangulationToGraph(triangles);
  var independentSet = getIndependentSet(graph, 8, mainTriangle);
  for(var i=0; i<independentSet.length; i++) {
    renderCircle(independentSet[i], "red");
  }
  logMessage("Found an independent set");
  setNextStep("Remove the independent set", function() {
    var newtriangles = removeIndependentSetFromTriangulation(triangles, independentSet);
    canvas.clearCanvas();
    renderOuterTriangle();
    renderGraphWithoutPoints(graph, independentSet, "blue"); //TODO
    logMessage("Removed the independent set");
    setNextStep("Retriangulate the holes", function() {
      logMessage("Retriangulated the holes left by the independent set");
      var holes = getHolesInPolygon(graph, independentSet);
      var holeTriangles = holes.map(triangulate);
      for(var i=0; i<holeTriangles.length; i++) {
        renderTriangulation(holeTriangles[i], "gray");
        newtriangles = newtriangles.concat(holeTriangles[i]);
      }
      callback(newtriangles);
    });
  });
  return independentSet;
}

function snapToPoint(p) {
  //If (x,y) is close to a point on the polygon, it returns that point
  for(var i=0; i<polygonParts.length; i++) {
    var polygon = polygonParts[i];
    for(var j=0; j<polygon.length; j++) {
      if(distanceSquared(p, polygon[j]) < 300) {
        console.log("snapping");
        return polygon[j].copy();
      }
    }
  }
  return p.copy();
}

function drawTemporarySegment(p1, p2) {
  console.log("Temporary segment TODO");
}

function segmentIntersectsAnyPolygon(seg) {
  return polygonParts.some(function(polygon) {
    return segmentIntersectsPolygon(polygon, seg);
  });
}

function canAppendPointToPolygon(polygon, p) {
  function intersectsVertex() {
    for(var i=1; i<polygon.length; i++) {
      if(polygon[i].equals(p))
        return true;
    }
    return false;
  }

  return polygon.length == 0 ||
    (!p.equals(polygon[polygon.length - 1]) && //Can't make an edge from a point to the same point
     (polygon.length <= 1 || !p.equals(polygon[polygon.length - 2])) && //No edge that already exists
     !intersectsVertex() &&
     !segmentIntersectsAnyPolygon(new LineSegment(polygon[polygon.length - 1], p)));
}

function renderTriangulation(triangles, color) {
  triangles.forEach(function (triangle) {
    renderLine(triangle, {
      strokeStyle: color,
      closed: true
    });
  });
}

function addPolygonSplit(split) {
  console.assert(split.length > 1);
  //Find which polygon part we want to split
  //Returns the index in the polygonParts array
  function whichPolygonPart() {
    var p = null;
    if(split.length > 2) {
      p = split[1];
    } else {
      //The split is a chord. Take the midpoint
      p = new Point((split[0].x + split[1].x)/2.0,
                    (split[0].y + split[1].y)/2.0);
      console.assert(!p.equals(split[0]) && !p.equals(split[1]));
    }
    //Only one polygon should contain the point
    var hitPolygon = -1;
    for(var i=0; i<polygonParts.length; i++) {
      if(pointIsInsidePolygon(p, polygonParts[i])) {
        console.assert(hitPolygon < 0);
        hitPolygon = i;
      }
    }
    console.assert(hitPolygon >= 0);
    return hitPolygon;
  }

  var polygonIndex = whichPolygonPart();

  //Split the polygon
  var polygon = polygonParts[polygonIndex];
  var parts = [[], []];
  var currentPart = 0; //Index in the parts array
  var innerSplit = split.slice(0); //All parts of the split except the first and last point
  innerSplit.splice(0, 1);
  innerSplit.splice(innerSplit.length - 1, 1);
  var splitEnds = [split[0], split[split.length - 1]];
  for(var i=0; i<polygon.length; i++) {
    if(polygon[i].equals(splitEnds[0]) ||
       polygon[i].equals(splitEnds[1])) {
      parts[0].push(polygon[i]);
      parts[1].push(polygon[i]);
      var toAppend = innerSplit;
      if(polygon[i].equals(splitEnds[1])) {
        toAppend = innerSplit.slice(0).reverse();
      }
      //Append the inner split and switch polygons
      parts[currentPart] = parts[currentPart].concat(toAppend);
      currentPart = currentPart == 0 ? 1 : 0;
    } else {
      parts[currentPart].push(polygon[i]);
    }
  }

  //Remove the old polygon from the array and replace it with the pair
  polygonParts.splice(polygonIndex, 1);
  polygonParts.push(parts[0]);
  polygonParts.push(parts[1]);
  console.log(parts);
}

function renderLine(points, options) {
  options.strokeStyle = options.strokeStyle || "black";
  if(typeof options.strokeWidth === 'undefined')
    options.strokeWidth = 1;
  for(var i=0; i<points.length; i++) {
    options['x' + (i+1)] = points[i].x;
    options['y' + (i+1)] = points[i].y;
  }
  canvas.drawLine(options);
}

function renderPolygons() {
  polygonParts.forEach(function (polygon) {
    for(var i=0; i<polygon.length; i++) {
      if(i == polygon.length - 1 && !fullPolygonIsComplete)
        renderCircle(polygon[i], "blue");
      else
        renderCircle(polygon[i], "black");
    }
    if(polygon == fullPolygon)
      strokeColor = "black";
    //Draw the lines connecting them
    renderLine(polygon, {
      closed: fullPolygonIsComplete,
      strokeStyle: strokeColor,
      strokeWidth: 3
    });
  });
}

function render(dontClearCanvas) {
  function renderPolygonSplitter() {
    for(var i=0; i<currentPolygonSplitter.length; i++) {
      renderCircle(currentPolygonSplitter[i], "red");
    }
    renderLine(currentPolygonSplitter, {
      strokeStyle: "red"
    });
  }

  if(!dontClearCanvas) {
    canvas.clearCanvas();
  }
  renderPolygons();
  if(currentPolygonSplitter.length > 0) {
    renderPolygonSplitter();
  }
  renderOuterTriangle();
}

function renderOuterTriangle() {
  renderLine(mainTriangle, {
    closed: true,
    strokeStyle: "brown",
    strokeWidth: 4
  });
}

function renderCircle(p, color) {
  canvas.drawArc({
    fillStyle: color,
    strokeStyle: "black",
    x: p.x,
    y: p.y,
    radius: 5
  });
}

