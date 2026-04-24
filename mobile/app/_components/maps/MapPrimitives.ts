import { Platform } from "react-native";

type MapPrimitivesShape = {
  MapView: any;
  Marker: any;
  Polyline: any;
};

let primitives: MapPrimitivesShape = {
  MapView: null,
  Marker: null,
  Polyline: null,
};

if (Platform.OS === "web") {
  const webPath = "./MapPrimitives.web";
  primitives = require(webPath) as MapPrimitivesShape;
} else {
  const nativePath = "./MapPrimitives.native";
  primitives = require(nativePath) as MapPrimitivesShape;
}

export const { MapView, Marker, Polyline } = primitives;
