import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import Company from "../models/Company";
import TicketNote from "../models/TicketNote";
import QuickMessage from "../models/QuickMessage";
import TicketTraking from "../models/TicketTraking";
import UserRating from "../models/UserRating";
import QueueOption from "../models/QueueOption";
import Schedule from "../models/Schedule";
import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";
import ContactList from "../models/ContactList";
import ContactListItem from "../models/ContactListItem";
import Baileys from "../models/Baileys";
import Chat from "../models/Chat";
import ChatUser from "../models/ChatUser";
import ChatMessage from "../models/ChatMessage";
import BaileysSessions from "../models/BaileysSessions";
import UserCompanySelectedQueue from "../models/UserCompanySelectedQueue";
import Proxy from "../models/Proxy";

// eslint-disable-next-line
const dbConfig = require("../config/database");

const sequelize = new Sequelize(dbConfig);

const models = [
  Company,
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  TicketNote,
  QuickMessage,
  TicketTraking,
  UserRating,
  QueueOption,
  Schedule,
  Tag,
  TicketTag,
  ContactList,
  ContactListItem,
  Baileys,
  Chat,
  ChatUser,
  ChatMessage,
  BaileysSessions,
  UserCompanySelectedQueue,
  Proxy
];

sequelize.addModels(models);

export default sequelize;
