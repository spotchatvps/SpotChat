import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";

const useStyles = makeStyles((theme) => ({
  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
}));

const ModalImageCors = ({ imageUrl }) => {
  const classes = useStyles();
  return (
    <ModalImage
      className={classes.messageMedia}
      smallSrcSet={imageUrl}
      medium={imageUrl}
      large={imageUrl}
      alt="image"
    />
  );
};

export default ModalImageCors;
