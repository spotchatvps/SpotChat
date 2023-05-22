import React, { useState, useEffect } from "react";

import { Avatar, Button, CardHeader } from "@material-ui/core";
import CopyIcon from "@material-ui/icons/FileCopy";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";

const TicketInfo = ({ contact, ticket, onClick }) => {
  const { user } = ticket;
  const [userName, setUserName] = useState("");
  const [contactName, setContactName] = useState("");

  useEffect(() => {
    if (contact) {
      setContactName(contact.name);
      if (document.body.offsetWidth < 600) {
        if (contact.name.length > 10) {
          const truncadName = contact.name.substring(0, 10) + "...";
          setContactName(truncadName);
        }
      }
    }

    if (user && contact) {
      setUserName(`${i18n.t("messagesList.header.assignedTo")} ${user.name}`);

      if (document.body.offsetWidth < 600) {
        setUserName(`${user.name}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyProtocol() {
    const range = document.createRange();
    range.selectNode(document.querySelector(".protocol-number"));
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    toast.info("O número de protocolo foi copiado");
  }

  function truncateProtocolNumber() {
    // return "SAC..." + ticket?.protocol.substr(-6, 6);
    return ticket?.protocol;
  }

  return (
    <CardHeader
      style={{ cursor: "pointer" }}
      titleTypographyProps={{ noWrap: true }}
      subheaderTypographyProps={{ noWrap: true }}
      avatar={
        <Avatar
          onClick={onClick}
          src={contact.profilePicUrl}
          alt="contact_image"
        />
      }
      title={
        <div onClick={onClick}>
          {contactName}
          <span
            style={{ marginLeft: 10, fontSize: 12, color: "rgb(149 148 148)" }}
          >
            {ticket.user && `${userName}`}
          </span>
        </div>
      }
      subheader={
        <>
          <Button
            style={{ fontSize: 10 }}
            size="small"
            variant="outlined"
            color="secondary"
            onClick={copyProtocol}
            title="Clique para copiar o protocolo"
            endIcon={<CopyIcon />}
          >
            {truncateProtocolNumber()}
          </Button>
          <span
            className="protocol-number"
            style={{ marginLeft: -10000, position: "absolute" }}
          >
            {ticket?.protocol}
          </span>
        </>
      }
    />
  );
};

export default TicketInfo;
