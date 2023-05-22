import { useState, useEffect } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { debounce } from "lodash";

const useTickets = ({
  searchParam,
  tags,
  users,
  pageNumber,
  status,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
  searchTab,
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    setLoading(true);
    const fetchTickets = async () => {
      try {
        const { data } = await api.get("/tickets", {
          params: {
            searchParam,
            pageNumber,
            tags,
            users,
            status,
            date,
            updatedAt,
            showAll,
            queueIds,
            withUnreadMessages,
          },
        });
        setTickets(data.tickets);
        setHasMore(data.hasMore);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };

    const handleFetchTickets = debounce(fetchTickets, 1000);

    handleFetchTickets();
  }, [
    searchParam,
    tags,
    users,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    queueIds,
    withUnreadMessages,
    searchTab,
  ]);

  return { tickets, loading, hasMore };
};

export default useTickets;
