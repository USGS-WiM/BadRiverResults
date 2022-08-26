//Copyright 2014 USGS Wisconsin Internet Mapping(WiM)
//Author: Erik Myers
//Template Created: May 17th, 2013 by WiM JS Dev Team

//04.03.2014 - NE - Added new allLayers object with all map layer info. new functions to automate adding of layers and building of available map layers box and explanation.
//07.16.2013 - NE - Add functionality for adding icon and execute zoom to scale.
//06.19.2013 - NE - Updated to create lat/lng scale bar programmatically after map is created and ready.
//06.18.2013 - TR - Added color style to USGSLinks <a> tags
//06.03.2013 - ESM - Adds function to build and display usgs links on user logo click
//12.03.2014 -ESM -  Adds infoButtons and explanation functionality to TOC main layout
//12.03.2014 -ESM -  Adds all layers and data with descriptions and functionality
//12.03.2014 -ESM -  Adds identifyTask and custom popup rendering

dojo.require("esri.arcgis.utils");
dojo.require("esri.dijit.Popup");
dojo.require("esri.dijit.Legend");
dojo.require("esri.dijit.BasemapGallery");
dojo.require("esri.graphic");
dojo.require("esri.map");
dojo.require("esri.tasks.locator");
dojo.require("esri.virtualearth.VETiledLayer");

dojo.require("dijit.form.CheckBox");
dojo.require("dijit.form.Button");
dojo.require("dijit.layout.BorderContainer");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit.TitlePane");
dojo.require("dijit.Tooltip");
dojo.require("dijit.Dialog");
dojo.require("dijit.Tooltip");

dojo.require("wim.CollapsingContainer");
dojo.require("wim.ExtentNav");
dojo.require("wim.LatLngScale");
dojo.require("wim.RefreshScreen");
dojo.require("wim.LinksBox");
dojo.require("wim.LoadingScreen");

//various global variables are set here (Declare here, instantiate below)
var map,
  legendLayers = [];
var layersObject = [];
var layerArray = [];
var radioGroupArray = [];
var staticLegendImage;
var identifyTask, identifyParams;
var navToolbar;
var locator;
var layerInfos;

var servicesURL =
  "https://gis1.wim.usgs.gov/server/rest/services/BadRiver/RESULTS/MapServer/";

function init() {
  //sets up the onClick listener for the USGS logo
  dojo.connect(dojo.byId("usgsLogo"), "onclick", showUSGSLinks);

  // a popup is constructed below from the dijit.Popup class, which extends some addtional capability to the InfoWindowBase class.
  var popup = new esri.dijit.Popup({}, dojo.create("div"));

  //IMPORANT: map object declared below. Basic parameters listed here.
  //String referencing container id for the map is required (in this case, "map", in the parens immediately following constructor declaration).
  //Default basemap is set using "basemap" parameter. See API reference page, esri.map Constructor Detail section for parameter info.
  //For template's sake, extent parameter has been set to contiguous US.
  //sliderStyle parameter has been commented out. Remove comments to get a large slider type zoom tool (be sure to fix CSS to prevent overlap with other UI elements)
  //infoWindow parameter sets what will be used as an infoWindow for a map click.
  //If using FeatureLayer,an infoTemplate can be set in the parameters of the FeatureLayer constructor, which will automagically generate an infoWindow.
  map = new esri.Map("map", {
    basemap: "topo",
    wrapAround180: true,
    extent: new esri.geometry.Extent({
      xmin: -10244854.90105959,
      ymin: 5752192.126571113,
      xmax: -9951336.712444402,
      ymax: 5921729.4553077,
      spatialReference: { wkid: 102100 },
    }),
    slider: true,
    sliderStyle: "small", //use "small" for compact version, "large" for long slider version
    logo: false,
    infoWindow: popup,
  });

  //navToolbar constructor declared, which serves the extent navigator tool.
  navToolbar = new esri.toolbars.Navigation(map);

  //dojo.connect method (a common Dojo framework construction) used to call mapReady function. Fires when the first or base layer has been successfully added to the map.
  dojo.connect(map, "onLoad", mapReady);

  //basemapGallery constructor which serves the basemap selector tool. List of available basemaps can be customized. Here,default ArcGIS online basemaps are set to be available.
  var basemapGallery = new esri.dijit.BasemapGallery(
    {
      showArcGISBasemaps: true,
      map: map,
    },
    "basemapGallery"
  );
  basemapGallery.startup();

  //basemapGallery error catcher
  dojo.connect(basemapGallery, "onError", function () {
    console.log("Basemap gallery failed");
  });

  //calls the executeSiteIdentifyTask function from a click on the map.
  dojo.connect(map, "onClick", executeSiteIdentifyTask);

  //This object contains all layer and their ArcGIS and Wim specific mapper properties (can do feature, wms and dynamic map layers)
  allLayers = {
    "Bad River Reservation": {
      url: servicesURL,
      visibleLayers: [35],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "ReservationCA",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Bad River Groundwatershed": {
      url: servicesURL,
      visibleLayers: [34],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "gwshed2",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Groundwater Contributing Areas": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "Just as a surface watershed is defined by the topography draining surface runoff to a single, downstream location, a similar concept can be defined for the area contributing groundwater to a given destination. A groundwatershed is the area contributing groundwater to the surface-water system within a watershed (at which point the groundwater joins the surface water in flowing to the downstream point that defines the watershed). The groundwater contributing area for the Bad River Reservation is defined as the area contributing groundwater flow that enters the reservation as groundwater (as opposed to the groundwater that discharges to a stream first, and then enters the reservation as surface water). Groundwater contribution is expressed as a percentage of flow ranging from 0 (no water in this area reaches the destination) to 100 (all water in this area reaches the destination). For example, in the case of the Bad River Reservation, all flow from the areas shaded in red reaches the reservation as groundwater. For more information, see the report section titled 'Delineation of Groundwater Contributing Areas.'",
      },
    },
    "Vertical head difference (Layer 4 - Layer 5)": {
      url: servicesURL,
      visibleLayers: [32],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "l4to5_dh",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Vertical head difference (Layer 3 - Layer 4)": {
      url: servicesURL,
      visibleLayers: [31],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "l3to4_dh",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Vertical head difference (Layer 2 - Layer 3)": {
      url: servicesURL,
      visibleLayers: [30],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "l2to3_dh",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Vertical head difference (Layer 1 - Layer 2)": {
      url: servicesURL,
      visibleLayers: [29],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "l1to2_dh",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Vertical head difference between layers (ft)": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "The vertical difference in simulated head between model layers. Negative values indicate upward flow. Areas with no color indicate dry cells in either the overlying or both layers.  (Note that if multiple layers are selected, the gradients for all saturated cells in those layers will be displayed simultaneously in order of the layering).",
      },
    },
    "Groundwater Discharge Simulated by UZF Package": {
      url: servicesURL,
      visibleLayers: [27],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "uzf_discharge",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Groundwater Discharge from UZF Package": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "Groundwater discharge simulated by the UZF package (http://pubs.usgs.gov/tm/2006/tm6a19/), which is routed to nearby streams (see “Groundwater discharge from UZF package” layer under the “Streamflow Results” section in this mapper). All values are in cubic feet per day (cfd). Groundwater discharge from the UZF package represents runoff from small seeps, wetlands and streams in low-lying areas that are not explicitly represented as discharge features in the model. For more information, see the report sections on Model Construction (p. 13), Limitations (p. 46), and the discussion on the representation of stream and lakes in Appendix 2 (p. 77-80).",
      },
    },
    "Water Table Elevation (raster)": {
      url: servicesURL,
      visibleLayers: [25],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "water_tabl",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Water Table Elevation (contour)": {
      url: servicesURL,
      visibleLayers: [24],
      arcOptions: {
        visible: true,
        opacity: 0.9,
        id: "water_table",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Water Table": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "Elevation contours of the water table surface and raster of the water table surface.",
      },
    },
    "Total Baseflow (cfd)": {
      url: servicesURL,
      visibleLayers: [22],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "Total Baseflow (cfd)",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
        zoomScale: "72224",
      },
    },
    "Stream-Aquifer Interactions": {
      url: servicesURL,
      visibleLayers: [21],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "Stream-Aquifer Interactions",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
        zoomScale: "72224",
      },
    },
    "Groundwater discharge from UZF package (cfd)": {
      url: servicesURL,
      visibleLayers: [20],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "Overland Flow (cfd)",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
        zoomScale: "72224",
      },
    },
    "Streamflow Results": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "Simulated streamflow components. All values are in cubic feet per day (cfd). Line widths for the Groundwater discharge from the UZF package and Total Baseflow indicate the simulated quantity of flow for those components in each stream cell. Groundwater discharge from the UZF package represents runoff from small seeps, wetlands and streams in low-lying areas that are not explicitly represented as discharge features in the model. For more information, see the report sections on Model Construction (p. 13), Limitations (p. 46), and the discussion on the representation of stream and lakes in Appendix 2 (p. 77-80). The sources of this discharge from the UZF package are shown on a cell-by-cell basis in the “Groundwater discharge simulated by UZF package” layer in this mapper.",
      },
    },
    "Layer 5 groundwater specific discharge vectors": {
      url: servicesURL,
      visibleLayers: [18],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "cbb_arrows5",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Layer 4 groundwater specific discharge vectors": {
      url: servicesURL,
      visibleLayers: [17],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "cbb_arrows4",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Layer 3 groundwater specific discharge vectors": {
      url: servicesURL,
      visibleLayers: [16],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "cbb_arrows3",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Layer 2 groundwater specific discharge vectors": {
      url: servicesURL,
      visibleLayers: [15],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "cbb_arrows2",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Layer 1 groundwater specific discharge vectors": {
      url: servicesURL,
      visibleLayers: [14],
      arcOptions: {
        visible: false,
        opacity: 0.9,
        id: "cbb_arrows1",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Groundwater flow velocity vectors": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "Arrows indicating groundwater flow direction and magnitude. Technically the sizing of the arrows is based on specific discharge, which is the total volume of flow divided by the area. For example, if all flow was through one face of a model cell, specific discharge (qs) would be the total discharge through that face (Q) divided by the width times the height of that cell face. qs is used instead of Q to normalize differences in flow caused by layer thickness. Red indicates downward flow through the layer bottom into the layer below; blue indicates upward flow from the layer below. Layer 5 does not have colors because of the no-flow boundary condition on the bottom of the model.",
      },
    },
    "Flux residuals for annual baseflows estimated from 2013 field measurements":
      {
        url: servicesURL,
        visibleLayers: [12],
        arcOptions: {
          visible: false,
          opacity: 0.95,
          id: "2013seepage_opt8c1_best6_rei",
        },
        wimOptions: {
          type: "layer",
          includeInLayerList: true,
          esriLegendLabel: false,
        },
      },
    "Flux residuals for the smallest streams ": {
      url: servicesURL,
      visibleLayers: [11],
      arcOptions: {
        visible: false,
        opacity: 0.95,
        id: "sm_streams_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Flux residuals for annual baseflows estimated from 2011 field measurements":
      {
        url: servicesURL,
        visibleLayers: [10],
        arcOptions: {
          visible: false,
          opacity: 0.95,
          id: "seepagerun_opt8c1_best6_rei",
        },
        wimOptions: {
          type: "layer",
          includeInLayerList: true,
          esriLegendLabel: false,
        },
      },
    "Flux residuals for annual baseflows in Gebert et al (2011)": {
      url: servicesURL,
      visibleLayers: [9],
      arcOptions: {
        visible: false,
        opacity: 0.95,
        id: "ofr_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Flux residual for the Bad River at Odanah (USGS site 04027000)": {
      url: servicesURL,
      visibleLayers: [8],
      arcOptions: {
        visible: false,
        opacity: 0.95,
        id: "bad_odanah_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Baseflow Residuals  (All values indicate relative percent difference between simulated and observed)":
      {
        wimOptions: {
          type: "heading",
          includeInLayerList: true,
          infoButton:
            "Difference between simulated and observed baseflows in streams - Colors indicate a category of relative percent difference of simulated from observed - negative (blue) values indicate simulated baseflows that are higher than observed - the size of the triangles indicates the absolute difference between simulated and observed (i.e. the total quantity of water missing, either above or below what was observed)",
        },
      },
    "Head residuals from group 'WCRS2'  (zero-weighted)": {
      url: servicesURL,
      visibleLayers: [6],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "wcrs2_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Head residuals from group 'WCRS1'": {
      url: servicesURL,
      visibleLayers: [5],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "wcrs1_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Head residuals from group 'NWIS poor' (zero-weighted)": {
      url: servicesURL,
      visibleLayers: [4],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "head_poor_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Head residuals from group 'NWIS fair'": {
      url: servicesURL,
      visibleLayers: [3],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "head_fair_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Head residuals from group 'NWIS good'": {
      url: servicesURL,
      visibleLayers: [2],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "head_good_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Head residuals from group 'NWIS best'": {
      url: servicesURL,
      visibleLayers: [1],
      arcOptions: {
        visible: false,
        opacity: 0.5,
        id: "head_best_opt8c1_best6_rei",
      },
      wimOptions: {
        type: "layer",
        includeInLayerList: true,
        esriLegendLabel: false,
      },
    },
    "Head Residuals": {
      wimOptions: {
        type: "heading",
        includeInLayerList: true,
        infoButton:
          "Difference between simulated and observed groundwater levels (heads) in feet. Negative values (blue) indicate simulated value that is higher than observed. The magnitudes of the residuals are indicated by both the colors and the sizes of the markers.",
      },
    },
  }; //END allLayers Object

  //this function fires after all layers have been added to map with the map.addLayers method above.
  //this function creates the legend element based on the legendLayers array which contains the relevant data for each layer.
  dojo.connect(map, "onLayersAddResult", function (results) {
    $("#legendDiv").hide();

    var legend = new esri.dijit.Legend(
      {
        map: map,
        layerInfos: legendLayers,
      },
      "legendDiv"
    );
    legend.startup();

    //IMPORTANT: IF REFERENCE LAYER NAMES CHANGE YOU NEED TO EDIT THIS OR IT WILL BOMB
    layerInfos = map.getLayer("head_best_opt8c1_best6_rei").layerInfos;

    //this counter to track first and last of items in legendLayers
    var i = 0;
    var lastItem = layersObject.length;
    //this forEach loop generates the checkbox toggles for each layer by looping through the legendLayers array (same way the legend element is generated).
    dojo.forEach(layersObject, function (layer) {
      var layerName = layer.title;

      if (layer.layer != "heading") {
        if (layer.toggleType == "radioParent") {
          var radioParentCheck = new dijit.form.CheckBox({
            name: "radioParentCheck" + layer.group,
            id: "radioParentCheck_" + layer.group,

            params: { group: layer.group },
            onChange: function (evt) {
              var radChildLayers = [];
              var grp = this.params.group;
              dojo.forEach(layersObject, function (layer) {
                if (grp == layer.group && layer.toggleType != "radioParent") {
                  radChildLayers.push(layer.layer);
                }
              });
              if (!this.checked) {
                dojo.forEach(radChildLayers, function (layer) {
                  layer.setVisibility(false);
                });
                var divs = dojo.query("." + grp);
                for (var i = 0; i < divs.length; i++) {
                  divs[i].style.display = "none";
                }
              }
              if (this.checked) {
                var divs = dojo.query("." + grp);
                for (var i = 0; i < divs.length; i++) {
                  divs[i].style.display = "block";
                }
                dojo.forEach(radChildLayers, function (layer) {
                  if (dojo.byId("radioButton" + layer.id).checked) {
                    layer.setVisibility(true);
                  }
                });
              }
              //Check radio buttons in this group to see what's visible
              //jquery selector to get based on group name and then loop through
              /*var checkLayer = map.getLayer(this.value);
							checkLayer.setVisibility(!checkLayer.visible);
							this.checked = checkLayer.visible;	*/
            },
          });
          var toggleDiv = dojo.doc.createElement("div");
          dojo.place(toggleDiv, dojo.byId("toggle"), "after");
          dojo.place(radioParentCheck.domNode, toggleDiv, "first");
          dojo.setStyle(toggleDiv, "paddingLeft", "15px");
          //TESTING
          if (layer.infoButtonText) {
            var infoButton = dojo.create(
              "div",
              {
                innerHTML:
                  '<img class="infoButton" title="Layer Group Explanation" style="height: 15px; width:15px; cursor:pointer;" src="images/infoGraphic.png" />',
              },
              toggleDiv
            ); //WORKS to add HTML div
            dojo.setStyle(infoButton, "float", "right");
            dojo.connect(infoButton, "onclick", function (evt) {
              var infoBox = new dijit.Dialog({
                title: layer.title + " Explanation",
                content: layer.infoButtonText,
                style: "width:400px;",
              });
              infoBox.show();
              dojo.byId("map").appendChild(infoBox);
              dojo.place(infoBox, dojo.byId("map"), "before");
            });
          }
          //END TESTING
          if (i == 0) {
            dojo.setStyle(toggleDiv, "paddingBottom", "10px");
          } else if (i == lastItem) {
            dojo.setStyle(toggleDiv, "paddingTop", "10px");
          }
          var radioParentCheckLabel = dojo.create(
            "label",
            { for: radioParentCheck.name, innerHTML: layerName },
            radioParentCheck.domNode,
            "after"
          );
          //NEEDS TO BE REMOVED ELSE THE INFOBUTTONS GET PUSHED DOWN TO THE NEXT LINE
          //dojo.place("<br/>",radioParentCheckLabel,"after");
        } else if (layer.toggleType == "radio") {
          var radioButton = new dijit.form.RadioButton({
            name: layer.group,
            id: "radioButton" + layer.layer.id,
            value: layer.layer.id,
            checked: layer.layer.visible,
            params: { group: layer.group },
            onChange: function (evt) {
              var radioLayer = map.getLayer(this.value);
              var parentID = "radioParentCheck_" + layer.group;
              this.checked && dijit.byId(parentID).checked
                ? radioLayer.setVisibility(true)
                : radioLayer.setVisibility(false);
            },
          });
          var toggleDiv = dojo.doc.createElement("div");
          dojo.place(toggleDiv, dojo.byId("toggle"), "after");
          dojo.place(radioButton.domNode, toggleDiv, "first");
          dojo.setAttr(toggleDiv, "class", radioButton.params.group);
          dojo.setStyle(toggleDiv, "paddingLeft", "25px");
          dojo.setStyle(toggleDiv, "display", "none");
          if (i == 0) {
            dojo.setStyle(toggleDiv, "paddingBottom", "10px");
          } else if (i == lastItem) {
            dojo.setStyle(toggleDiv, "paddingTop", "10px");
          }
          var radioLabel = dojo.create(
            "label",
            { for: radioButton.name, innerHTML: layerName },
            radioButton.domNode,
            "after"
          );
          dojo.place("<br/>", radioLabel, "after");

          /*} else if (layer.toggleType == 'expand') {

					//IN PROGRESS
					var expandButton = new dijit.form.Button({
						label: "+",
						onClick: function(evt){

						}
					});*/
        } else {
          var checkBox = new dijit.form.CheckBox({
            name: "checkBox" + layer.layer.id,
            value: layer.layer.id,
            checked: layer.layer.visible,
            onChange: function (evt) {
              var checkLayer = map.getLayer(this.value);
              checkLayer.setVisibility(!checkLayer.visible);
              this.checked = checkLayer.visible;
              if (
                allLayers[layerName].wimOptions.includeLegend == true &&
                allLayers[layerName].wimOptions.staticLegendOptions
                  .hasStaticLegend == true
              ) {
                if (checkLayer.visible) {
                  $("#" + layer.layer.id + "Legend").show();
                } else {
                  $("#" + layer.layer.id + "Legend").hide();
                }
              }
            },
          });
          if (allLayers[layerName].wimOptions.zoomScale) {
            //create the holder for the checkbox and zoom icon
            var toggleDiv = dojo.doc.createElement("div");
            dojo.place(toggleDiv, dojo.byId("toggle"), "after");
            dojo.place(checkBox.domNode, toggleDiv, "first");
            var checkLabel = dojo.create(
              "label",
              { for: checkBox.name, innerHTML: layerName },
              checkBox.domNode,
              "after"
            );
            var scale = allLayers[layerName].wimOptions.zoomScale;
            var zoomImage = dojo.doc.createElement("div");
            zoomImage.id = "zoom" + layer.layer.id;
            zoomImage.innerHTML =
              '<img id="zoomImage" title="zoom to visible scale" style="height: 18px;width: 18px; cursor: pointer" src="images/zoom.gif" />';
            dojo.connect(zoomImage, "click", function () {
              if (map.getScale() > scale) {
                map.setScale(scale);
              }
            });
            dojo.place(zoomImage, toggleDiv, "last");
            dojo.setStyle(checkBox.domNode, "float", "left");
            dojo.setStyle(toggleDiv, "paddingLeft", "15px");
            dojo.setStyle(checkLabel, "float", "left");
            dojo.setStyle(toggleDiv, "paddingTop", "5px");
            dojo.setStyle(dojo.byId("zoomImage"), "paddingLeft", "10px");
            dojo.setStyle(toggleDiv, "height", "25px");
            if (i == 0) {
              dojo.setStyle(toggleDiv, "paddingBottom", "10px");
            } else if (i == lastItem) {
              dojo.setStyle(toggleDiv, "paddingTop", "10px");
            }
            dojo.place("<br/>", zoomImage, "after");
          } else {
            var toggleDiv = dojo.doc.createElement("div");
            dojo.place(toggleDiv, dojo.byId("toggle"), "after");
            dojo.place(checkBox.domNode, toggleDiv, "first");
            dojo.setStyle(toggleDiv, "paddingLeft", "15px");
            if (i == 0) {
              dojo.setStyle(toggleDiv, "paddingBottom", "10px");
            } else if (i == lastItem) {
              dojo.setStyle(toggleDiv, "paddingTop", "10px");
            }
            var checkLabel = dojo.create(
              "label",
              { for: checkBox.name, innerHTML: layerName },
              checkBox.domNode,
              "after"
            );
            dojo.place("<br/>", checkLabel, "after");
          }
        }
      } else {
        var headingDiv = dojo.doc.createElement("div");
        headingDiv.innerHTML = layer.title;
        dojo.place(headingDiv, dojo.byId("toggle"), "after");
        dojo.addClass(headingDiv, "heading");
        dojo.setStyle(headingDiv, "paddingTop", "10px");
        dojo.setStyle(headingDiv, "color", "#D3CFBA");
        if (layer.infoButtonText) {
          var infoButton = dojo.create(
            "div",
            {
              innerHTML:
                '<img class="infoButton" title="Layer Group Explanation" style="height: 15px; width:15px; cursor:pointer;" src="images/infoGraphic.png" />',
            },
            headingDiv
          ); //WORKS to add HTML div
          dojo.setStyle(infoButton, "float", "right");
          dojo.connect(infoButton, "onclick", function (evt) {
            //console.log(layer.infoButtonText);
            //var infoBox = dojo.create('div', {innerHTML: layer.infoButtonText}, dojo.byId('availableLayers'));
            var infoBox = new dijit.Dialog({
              title: layer.title + " Explanation",
              content: layer.infoButtonText,
              style: "width:400px;",
            });
            infoBox.show();

            //dojo.byId('map').appendChild(infoBox);
          });
        }
        if (i == 0) {
          dojo.setStyle(headingDiv, "paddingBottom", "10px");
          dojo.setStyle(infoButton, "float", "left");
        } else if (i == lastItem) {
          dojo.setStyle(headingDiv, "paddingTop", "10px");
        }
      }
      i++;
    });

    //function to handle styling adjustments to the esri legend dijit
    setTimeout(function () {
      $.each($('div[id^="legendDiv_"]'), function (index, item) {
        for (layer in allLayers) {
          if (layer == $("#" + item.id + " span").html()) {
            if (
              allLayers[layer].wimOptions.esriLegendLabel !== undefined &&
              allLayers[layer].wimOptions.esriLegendLabel == false
            ) {
              $("#" + item.id + " table.esriLegendLayerLabel").remove();
            }
          }
        }
      });
      $("#legendDiv").show();
    }, 1000);
  });

  addAllLayers();

  //OPTIONAL: the below remaining lines within the init function are for performing an identify task on a layer in the mapper.
  // the following 7 lines establish an IdentifyParameters object(which is an argument for an identifyTask.execute method)and specifies the criteria used to identify features.
  // the constructor of the identifyTask is especially important. the service URL there should match that of the layer from which you'd like to identify.
  identifyParams = new esri.tasks.IdentifyParameters();
  identifyParams.tolerance = 8;
  identifyParams.returnGeometry = true;
  identifyParams.layerOption =
    esri.tasks.IdentifyParameters.LAYER_OPTION_VISIBLE;
  identifyParams.width = map.width;
  identifyParams.height = map.height;
  //identifyParams.layerIds = visibleLayers;
  identifyTask = new esri.tasks.IdentifyTask(servicesURL);

  //OPTIONAL: the following function carries out an identify task query on a layer and returns attributes for the feature in an info window according to the
  //InfoTemplate defined below. It is also possible to set a default info window on the layer declaration which will automatically display all the attributes
  //for the layer in the order they come from the table schema. This code below creates custom labels for each field and substitutes in the value using the notation ${[FIELD NAME]}.
  function executeSiteIdentifyTask(evt) {
    //variables are reset for each click event
    var visibleLayers = [];
    var layersOnly = [];

    //remove non-spatial layers from the layerInfos array (i.e. heading/radioparents/etc)
    for (var i = 0; i < layerInfos.length; i++) {
      if (layerInfos[i].parentLayerId != -1) {
        layersOnly.push(layerInfos[i]); //push entire layer info object into layersOnly array for SPATIAL LAYERS ONLY
      }
    }

    //loop through to find only the currently visible spatial layers
    for (var i = 0; i < layersOnly.length; i++) {
      if (
        map.getLayer(layersOnly[i].name) != undefined &&
        map.getLayer(layersOnly[i].name).visible == true
      ) {
        visibleLayers.push(layersOnly[i].id); //visible spatial layers only
      } else {
        continue;
      }
    }

    identifyParams.layerIds = visibleLayers; //set layer Id array to visibleLayers Variable
    identifyParams.geometry = evt.mapPoint;
    identifyParams.mapExtent = map.extent;

    // the deferred variable is set to the parameters defined above and will be used later to build the contents of the infoWindow.
    var deferredResult = identifyTask.execute(identifyParams);

    deferredResult.addCallback(function (response) {
      // response is an array of identify result objects
      // dojo.map is used to set the variable feature to each result in the response array and apply the same template to each of those features,
      return dojo.map(response, function (result) {
        var feature = result.feature;
        feature.attributes.layerName = result.layerName;

        //Head Residuals (group)
        if (result.layerId <= 6) {
          var template = new esri.InfoTemplate(
            "Head Residuals",
            "<b>Name</b>: ${name}<br/>" +
              "<b>Residual</b>: ${residual}<br/>" +
              "<b>Measured</b>: ${meas}<br/>" +
              "<b>Modeled</b>: ${modeled}<br/>" +
              "<b>Weight</b>: ${weight}<br/>" +
              "<b>Screen Top</b>: ${sctop}<br/>" +
              "<b>Screen Bottom</b>: ${scbot}<br/>" +
              "<b>Top Layer</b>: ${top_layer}<br/>" +
              "<b>Bottom Layer</b>: ${bot_layer}<br/>"
          );

          //Baseflow Residuals (group)
        } else if (result.layerId >= 7 && result.layerId <= 12) {
          var template = new esri.InfoTemplate(
            "Baseflow Residuals",
            "<b>Name</b>: ${name}<br/>" +
              "<b>Residual</b>: ${residual}<br/>" +
              "<b>Measured</b>: ${meas}<br/>" +
              "<b>Modeled</b>: ${modeled}<br/>" +
              "<b>Percent Error</b>: ${pct_error}<br/>" +
              "<b>Weight</b>: ${weight}<br/>"
          );

          //Groundwater Flow Velocity Vectors (group)
        } else if (result.layerId >= 13 && result.layerId <= 18) {
          var template = new esri.InfoTemplate(
            "Groundwater Velocity Vectors",
            "<b>Direction</b>: ${updown}<br/>" + "<b>Q</b>: ${Q}<br/>"
          );

          //overland flow
        } else if (result.layerId == 20) {
          var template = new esri.InfoTemplate(
            "Overland Flow",
            "<b>Loss/Gain (cfd)</b>: ${loss}<br/>" +
              "<b>Overland (cfd)</b>: ${overland}<br/>" +
              "<b>Baseflow (cfd)</b>: ${flow}<br/>" +
              "<b>Stage (cfd)</b>: ${stage}<br/>"
          );

          //Stream-Aquifer Interactions
        } else if (result.layerId == 21) {
          var template = new esri.InfoTemplate(
            "Stream-Aquifer Interactions",
            "<b>Loss/Gain (cfd)</b>: ${loss}<br/>" +
              "<b>Overland (cfd)</b>: ${overland}<br/>" +
              "<b>Baseflow (cfd)</b>: ${flow}<br/>" +
              "<b>Stage (cfd)</b>: ${stage}<br/>"
          );

          //Total Baseflow
        } else if (result.layerId == 22) {
          var template = new esri.InfoTemplate(
            "Total Baseflow",
            "<b>Loss/Gain (cfd)</b>: ${loss}<br/>" +
              "<b>Overland (cfd)</b>: ${overland}<br/>" +
              "<b>Baseflow (cfd)</b>: ${flow}<br/>" +
              "<b>Stage (cfd)</b>: ${stage}<br/>"
          );

          //Water Table Contour
        } else if (result.layerId == 24) {
          var template = new esri.InfoTemplate(
            "Water Table Elevation",
            "<b>Contour Elevation </b>: ${CONTOUR} ft.<br/>"
          );

          //Water Table Raster
        } else if (result.layerId == 25) {
          var pixelValue = result.feature.attributes["Pixel Value"];
          var template = new esri.InfoTemplate(
            "Water Table Elevation",
            "<b>Elevation Pixel </b>: " + pixelValue + " ft.<br/>"
          );

          //UZF Discharge  / Streamflow Routing Cells (group)
        } else if (result.layerId == 27) {
          var pixelValue = result.feature.attributes["Pixel Value"];
          var template = new esri.InfoTemplate(
            "UZF Discharge",
            "<b>PIXEL VALUE </b>: " + pixelValue + " ft.<br/>"
          );

          //Vertical Head Difference (group)
        } else if (result.layerId >= 28 && result.layerId <= 32) {
          map.infoWindow.resize(350, 400);
          var pixelValue = result.feature.attributes["Pixel Value"];
          var template = new esri.InfoTemplate(
            "Vertical Head Difference",
            "<b>Vertical Head Difference Between Layers</b>: " +
              pixelValue +
              " ft.<br/>"
          );

          //handle other rasters that have result.layerName == "" || result.layerName == undefined
        } else {
          var pixelValue = result.feature.attributes["Pixel Value"];
          var template = new esri.InfoTemplate(
            "Raster Query",
            "<b>Pixel Value</b>: ${Pixel Value}"
          );
        }

        //set the customized template for displaying content in the info window. HTML tags can be used for styling.
        // The string before the comma within the parens immediately following the constructor sets the title of the info window.

        //ties the above defined InfoTemplate to the feature result returned from a click event
        feature.setInfoTemplate(template);

        //returns the value of feature, which is the result of the click event
        return feature;
      });
    });

    //sets the content that informs the info window to the previously established "deferredResult" variable.
    map.infoWindow.setFeatures([deferredResult]);
    //tells the info window to render at the point where the user clicked.
    map.infoWindow.show(evt.mapPoint);
  }
  //end executeSiteIdentifyTask method

  //Geocoder reference to geocoding services
  locator = new esri.tasks.Locator(
    "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
  );
  //calls the function that does the goeocoding logic (found in geocoder.js, an associated JS module)*
  dojo.connect(locator, "onAddressToLocationsComplete", showResults);
}
//end of init function

//mapReady function that fires when the first or base layer has been successfully added to the map. Very useful in many situations. called above by this line: dojo.connect(map, "onLoad", mapReady)
function mapReady(map) {
  //Sets the globe button on the extent nav tool to reset extent to the initial extent.
  dijit.byId("extentSelector").set("initExtent", map.extent);

  dojo.style("loadingScreen", "opacity", "0.75");
  var loadingUpdate = dojo.connect(map, "onUpdateStart", function () {
    dojo.style("loadingScreen", "visibility", "visible");
  });

  dojo.connect(map, "onUpdateEnd", function () {
    //commented out because of DropDown loading-- look at AllDone()
    dojo.style("loadingScreen", "visibility", "hidden");
    dojo.disconnect(loadingUpdate);

    dojo.connect(map, "onUpdateStart", function () {
      dojo.style("refreshScreen", "visibility", "visible");
    });

    dojo.connect(map, "onUpdateEnd", function () {
      dojo.style("refreshScreen", "visibility", "hidden");
    });
  });

  //Create scale bar programmatically because there are some event listeners that can't be set until the map is created.
  //Just uses a simple div with id "latLngScaleBar" to contain it
  var latLngBar = new wim.LatLngScale({ map: map }, "latLngScaleBar");
}

//function to iterate through allLayers array and build array for legend as well as array for adding services based on esri and wim specific options
function addAllLayers() {
  for (layer in allLayers) {
    if (allLayers[layer].wimOptions.type == "layer") {
      console.log(layer);
      var newLayer;
      if (allLayers[layer].wimOptions.layerType == "agisFeature") {
        newLayer = new esri.layers.FeatureLayer(
          allLayers[layer].url,
          allLayers[layer].arcOptions
        );
      } else if (allLayers[layer].wimOptions.layerType == "agisWMS") {
        newLayer = new esri.layers.WMSLayer(
          allLayers[layer].url,
          allLayers[layer].arcOptions
        );
        if (
          allLayers[layer].wimOptions.includeLegend == true &&
          allLayers[layer].wimOptions.staticLegendOptions.hasStaticLegend ==
            true
        ) {
          var staticLegendImage = dojo.doc.createElement("div");
          staticLegendImage.id = allLayers[layer].arcOptions.id + "Legend";
          staticLegendImage.innerHTML =
            '<b style="">' +
            allLayers[layer].wimOptions.staticLegendOptions.legendTitle +
            '</b><br/><img style="padding-top: 10px; width: ' +
            (parseInt($("#explanation").width()) - 25).toString() +
            'px" src="' +
            allLayers[layer].wimOptions.staticLegendOptions.legendUrl +
            '" />';
          dojo.place(staticLegendImage, dojo.byId("legendDiv"), "after");
          if (allLayers[layer].arcOptions.visible == false) {
            $("#" + staticLegendImage.id).hide();
          }
        }
      } else {
        newLayer = new esri.layers.ArcGISDynamicMapServiceLayer(
          allLayers[layer].url,
          allLayers[layer].arcOptions
        );
        if (allLayers[layer].visibleLayers) {
          newLayer.setVisibleLayers(allLayers[layer].visibleLayers);
        }
      }

      //set wim options
      if (allLayers[layer].wimOptions) {
        if (allLayers[layer].wimOptions.includeInLayerList == true) {
          if (
            allLayers[layer].wimOptions.layerOptions &&
            allLayers[layer].wimOptions.layerOptions.selectorType == "radio"
          ) {
            radioGroup = allLayers[layer].wimOptions.layerOptions.radioGroup;
            radioGroupArray.push({ group: radioGroup, layer: newLayer });

            addToObjects(
              {
                layer: newLayer,
                type: "layer",
                title: layer,
                toggleType: "radio",
                group: radioGroup,
              },
              allLayers[layer].wimOptions
            );
          } else {
            addToObjects(
              {
                layer: newLayer,
                type: "layer",
                title: layer,
                toggleType: "checkbox",
                group: "",
              },
              allLayers[layer].wimOptions
            );
          }
        }
      } else {
        addToObjects(
          { layer: newLayer, title: layer },
          allLayers[layer].wimOptions
        );
      }
      layerArray.push(newLayer);
    } else if (allLayers[layer].wimOptions.type == "radioParent") {
      radioGroup = allLayers[layer].wimOptions.layerOptions.radioGroup;
      radioGroupArray.push({ group: radioGroup, layer: null });

      // ORIGINAL  layersObject.push({layer:null, type: "radioParent", title: layer, toggleType: "radioParent", group: radioGroup});
      if (allLayers[layer].wimOptions.infoButton != undefined) {
        var infoButtonText = allLayers[layer].wimOptions.infoButton;
        layersObject.push({
          layer: null,
          type: "radioParent",
          title: layer,
          toggleType: "radioParent",
          group: radioGroup,
          infoButtonText: infoButtonText,
        });
      } else {
        layersObject.push({
          layer: null,
          type: "radioParent",
          title: layer,
          toggleType: "radioParent",
          group: radioGroup,
        });
      }
    } else {
      //ORIGINAL layersObject.push({layer: "heading", title: layer});

      //push infoButton text into layerObject array if it exists
      if (allLayers[layer].wimOptions.infoButton != undefined) {
        var infoButtonText = allLayers[layer].wimOptions.infoButton;
        layersObject.push({
          layer: "heading",
          title: layer,
          infoButtonText: infoButtonText,
        });
      } else {
        layersObject.push({ layer: "heading", title: layer });
      }
    }
  }

  map.addLayers(layerArray);

  function addToObjects(fullObject, wimOptions) {
    layersObject.push(fullObject);
    if (wimOptions.includeLegend != false) {
      legendLayers.push(fullObject);
    }
  }
}

// USGS Logo click handler function
function showUSGSLinks(evt) {
  //check to see if there is already an existing linksDiv so that it is not build additional linksDiv. Unlikely to occur since the usgsLinks div is being destroyed on mouseleave.
  if (!dojo.byId("usgsLinks")) {
    //create linksDiv
    var linksDiv = dojo.doc.createElement("div");
    linksDiv.id = "usgsLinks";
    //LINKS BOX HEADER TITLE HERE
    linksDiv.innerHTML = '<div class="usgsLinksHeader"><b>USGS Links</b></div>';
    //USGS LINKS GO HERE
    linksDiv.innerHTML += "<p>";
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://www.usgs.gov/">USGS Home</a><br />';
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://www.usgs.gov/ask/">Contact USGS</a><br />';
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://search.usgs.gov/">Search USGS</a><br />';
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://www.usgs.gov/laws/accessibility.html">Accessibility</a><br />';
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://www.usgs.gov/foia/">FOIA</a><br />';
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://www.usgs.gov/laws/privacy.html">Privacy</a><br />';
    linksDiv.innerHTML +=
      '<a style="color:white" target="_blank" href="http://www.usgs.gov/laws/policies_notices.html">Policies and Notices</a></p>';

    //place the new div at the click point minus 5px so the mouse cursor is within the div
    linksDiv.style.top = evt.clientY - 5 + "px";
    linksDiv.style.left = evt.clientX - 5 + "px";

    //add the div to the document
    dojo.byId("map").appendChild(linksDiv);
    //on mouse leave, call the removeLinks function
    dojo.connect(dojo.byId("usgsLinks"), "onmouseleave", removeLinks);
  }
}

//remove (destroy) the usgs Links div (called on mouseleave event)
function removeLinks() {
  dojo.destroy("usgsLinks");
}

dojo.ready(init);
//IMPORTANT: while easy to miss, this little line above makes everything work. it fires when the DOM is ready and all dojo.require calls have been resolved.
//Also when all other JS has been parsed, as it lives here at the bottom of the document. Once all is parsed, the init function is executed*
