import React, { useState, useEffect } from "react";
import {
  makeStyles,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Select,
  Switch,
  FormControlLabel,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import { Edit as EditIcon } from "@material-ui/icons";

import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import ModalUsers from "../ModalUsers";
import api from "../../services/api";
import { head, isArray } from "lodash";
import { useDate } from "../../hooks/useDate";

import moment from "moment";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  mainPaper: {
    width: "100%",
    flex: 1,
    padding: theme.spacing(2),
  },
  fullWidth: {
    width: "100%",
  },
  tableContainer: {
    width: "100%",
    overflowX: "scroll",
    ...theme.scrollbarStyles,
  },
  textfield: {
    width: "100%",
  },
  textRight: {
    textAlign: "right",
  },
  row: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  control: {
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  },
  buttonContainer: {
    textAlign: "right",
    padding: theme.spacing(1),
  },
}));

export function CompanyForm(props) {
  const {
    onSubmit,
    onDelete,
    onArchive,
    onFilterArchived,
    filterArchived,
    onCancel,
    onSearchCompanyChanged,
    initialValue,
    loading,
  } = props;
  const classes = useStyles();
  const [modalUser, setModalUser] = useState(false);
  const [firstUser, setFirstUser] = useState({});
  const [searchCompany, setSearchCompany] = useState("");

  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    status: true,
    dueDate: "",
    recurrence: "",
    document: "",
    paymentMethod: "",
    archived: false,
    archivedAt: "",
    ...initialValue,
  });

  useEffect(() => {
    setRecord((prev) => {
      if (moment(initialValue).isValid()) {
        initialValue.dueDate = moment(initialValue.dueDate).format(
          "YYYY-MM-DD"
        );
      }
      return {
        ...prev,
        ...initialValue,
      };
    });
  }, [initialValue]);

  useEffect(() => {
    onSearchCompanyChanged(searchCompany);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCompany]);

  const handleSubmit = async (data) => {
    if (data.dueDate === "" || moment(data.dueDate).isValid() === false) {
      data.dueDate = null;
    }
    onSubmit(data);
  };

  const handleOpenModalUsers = async () => {
    try {
      const { data } = await api.get("/users/list", {
        params: {
          companyId: initialValue.id,
        },
      });
      if (isArray(data) && data.length) {
        setFirstUser(head(data));
      }
      setModalUser(true);
    } catch (e) {
      toast.error(e);
    }
  };

  const handleCloseModalUsers = () => {
    setFirstUser({});
    setModalUser(false);
  };

  const incrementDueDate = () => {
    const data = { ...record };
    if (data.dueDate !== "" && data.dueDate !== null) {
      switch (data.recurrence) {
        case "MENSAL":
          data.dueDate = moment(data.dueDate)
            .add(1, "month")
            .format("YYYY-MM-DD");
          break;
        case "BIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(2, "month")
            .format("YYYY-MM-DD");
          break;
        case "TRIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(3, "month")
            .format("YYYY-MM-DD");
          break;
        case "SEMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(6, "month")
            .format("YYYY-MM-DD");
          break;
        case "ANUAL":
          data.dueDate = moment(data.dueDate)
            .add(12, "month")
            .format("YYYY-MM-DD");
          break;
        default:
          break;
      }
    }
    setRecord(data);
  };

  const formStyle = () => {
    if (record.id !== undefined && record.id !== "") {
      return {
        backgroundColor: "#c2e3fc",
        padding: "20px 10px",
        borderRadius: 20,
      };
    }
  };

  return (
    <>
      <ModalUsers
        userId={firstUser.id}
        companyId={initialValue.id}
        open={modalUser}
        onClose={handleCloseModalUsers}
      />
      <Formik
        enableReinitialize
        className={classes.fullWidth}
        initialValues={record}
        onSubmit={(values, { resetForm }) =>
          setTimeout(() => {
            handleSubmit(values);
            resetForm();
          }, 500)
        }
      >
        {(values, setValues) => (
          <Form className={classes.fullWidth} style={formStyle()}>
            <Grid spacing={2} justifyContent="flex-end" container>
              <Grid xs={12} sm={6} md={4} item>
                <Field
                  as={TextField}
                  label="Nome"
                  name="name"
                  variant="outlined"
                  className={classes.fullWidth}
                  margin="dense"
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <Field
                  as={TextField}
                  label="E-mail"
                  name="email"
                  variant="outlined"
                  className={classes.fullWidth}
                  margin="dense"
                  required
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <Field
                  as={TextField}
                  label="CPF/CNPJ"
                  name="document"
                  variant="outlined"
                  className={classes.fullWidth}
                  margin="dense"
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <Field
                  as={TextField}
                  label="Telefone"
                  name="phone"
                  variant="outlined"
                  className={classes.fullWidth}
                  margin="dense"
                />
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth>
                  <InputLabel htmlFor="status-selection">Status</InputLabel>
                  <Field
                    as={Select}
                    id="status-selection"
                    label="Status"
                    labelId="status-selection-label"
                    name="status"
                    margin="dense"
                  >
                    <MenuItem value={true}>Ativa</MenuItem>
                    <MenuItem value={false}>Inativa</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={4} item>
                <FormControl margin="dense" variant="outlined" fullWidth>
                  <InputLabel htmlFor="payment-method-selection">
                    Método de Pagamento
                  </InputLabel>
                  <Field
                    as={Select}
                    id="payment-method-selection"
                    label="Método de Pagamento"
                    labelId="payment-method-selection-label"
                    name="paymentMethod"
                    margin="dense"
                  >
                    <MenuItem value={"mercado_pago"}>Mercado Pago</MenuItem>
                    <MenuItem value={"hotmart"}>Hotmart</MenuItem>
                    <MenuItem value={"pix"}>PIX</MenuItem>
                    <MenuItem value={"transferencia"}>
                      Transferência Bancária
                    </MenuItem>
                    <MenuItem value={"cartao"}>Cartão</MenuItem>
                    <MenuItem value={"boleto"}>Boleto</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl variant="outlined" fullWidth>
                  <Field
                    as={TextField}
                    label="Data de Vencimento"
                    type="date"
                    name="dueDate"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    variant="outlined"
                    fullWidth
                    margin="dense"
                  />
                </FormControl>
              </Grid>
              <Grid xs={12} sm={6} md={2} item>
                <FormControl margin="dense" variant="outlined" fullWidth>
                  <InputLabel htmlFor="recorrencia-selection">
                    Recorrência
                  </InputLabel>
                  <Field
                    as={Select}
                    label="Recorrência"
                    labelId="recorrencia-selection-label"
                    id="recurrence"
                    name="recurrence"
                    margin="dense"
                  >
                    <MenuItem value="MENSAL">Mensal</MenuItem>
                    <MenuItem value="BIMESTRAL">Bimestral</MenuItem>
                    <MenuItem value="TRIMESTRAL">Trimestral</MenuItem>
                    <MenuItem value="SEMESTRAL">Semestral</MenuItem>
                    <MenuItem value="ANUAL">Anual</MenuItem>
                  </Field>
                </FormControl>
              </Grid>
              <Grid xs={12} item>
                <Grid justifyContent="flex-end" spacing={1} container>
                  <Grid
                    xs={12}
                    md={3}
                    style={{ textAlign: "right", marginTop: 10 }}
                    item
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={filterArchived}
                          onChange={(e) => onFilterArchived(e.target.checked)}
                          name="filterArchived"
                          color="primary"
                        />
                      }
                      label="Exibir Arquivadas"
                    />
                  </Grid>
                  {(record.id === "" || record.id === undefined) && (
                    <Grid xs={12} md={3} item>
                      <Field
                        as={TextField}
                        label="Pesquisa"
                        variant="outlined"
                        className={classes.fullWidth}
                        margin="dense"
                        value={searchCompany}
                        onChange={(e) => setSearchCompany(e.target.value)}
                      />
                    </Grid>
                  )}
                  <Grid xs={6} md={1} item>
                    <ButtonWithSpinner
                      className={classes.fullWidth}
                      style={{ marginTop: 7 }}
                      loading={loading}
                      onClick={() => onCancel()}
                      variant="contained"
                    >
                      Limpar
                    </ButtonWithSpinner>
                  </Grid>
                  {record.id !== undefined && record.id !== "" ? (
                    <>
                      <Grid xs={6} md={2} item>
                        <ButtonWithSpinner
                          style={{ marginTop: 7 }}
                          className={classes.fullWidth}
                          loading={loading}
                          onClick={() => onArchive()}
                          variant="contained"
                          color="secondary"
                        >
                          {record.archived === true ? (
                            <span>Desarquivar</span>
                          ) : (
                            <span>Arquivar</span>
                          )}
                        </ButtonWithSpinner>
                      </Grid>
                      {record.archived && (
                        <Grid xs={6} md={1} item>
                          <ButtonWithSpinner
                            style={{ marginTop: 7 }}
                            className={classes.fullWidth}
                            loading={loading}
                            onClick={() => onDelete(record)}
                            variant="contained"
                            color="secondary"
                          >
                            Excluir
                          </ButtonWithSpinner>
                        </Grid>
                      )}
                      <Grid xs={6} md={2} item>
                        <ButtonWithSpinner
                          style={{ marginTop: 7 }}
                          className={classes.fullWidth}
                          loading={loading}
                          onClick={() => incrementDueDate()}
                          variant="contained"
                          color="primary"
                        >
                          + Vencimento
                        </ButtonWithSpinner>
                      </Grid>
                      <Grid xs={6} md={1} item>
                        <ButtonWithSpinner
                          style={{ marginTop: 7 }}
                          className={classes.fullWidth}
                          loading={loading}
                          onClick={() => handleOpenModalUsers()}
                          variant="contained"
                          color="primary"
                        >
                          Usuário
                        </ButtonWithSpinner>
                      </Grid>
                    </>
                  ) : null}
                  <Grid xs={6} md={1} item>
                    <ButtonWithSpinner
                      className={classes.fullWidth}
                      style={{ marginTop: 7 }}
                      loading={loading}
                      type="submit"
                      variant="contained"
                      color="primary"
                    >
                      Salvar
                    </ButtonWithSpinner>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    </>
  );
}

export function CompaniesManagerGrid(props) {
  const { records, selected, onSelect } = props;
  const classes = useStyles();
  const { dateToClient } = useDate();

  const renderStatus = (row) => {
    if (row.archived) {
      return (
        <>
          Arquivada <br />
          {dateToClient(row.archivedAt)}
        </>
      );
    }

    return row.status === false ? "Inativa" : "Ativa";
  };

  const rowStyle = (record) => {
    if (record.archived) {
      return { backgroundColor: "#dbdbdb" };
    }
    if (
      typeof selected === "object" &&
      selected.id !== undefined &&
      selected.id === record.id
    ) {
      return { backgroundColor: "#c2e3fc" };
    }
    if (moment(record.dueDate).isValid()) {
      const now = moment();
      const dueDate = moment(record.dueDate);
      const diff = dueDate.diff(now, "days");

      if (diff === 5) {
        return { backgroundColor: "#fffead" };
      }
      if (diff >= -3 && diff <= 4) {
        return { backgroundColor: "#f7cc8f" };
      }
      if (diff <= -4) {
        return { backgroundColor: "#fa8c8c" };
      }
    }
    return {};
  };

  const getPaymentMethodValue = (val) => {
    if (val === "mercado_pago") {
      return "Mercado Pago";
    }
    if (val === "hotmart") {
      return "Hotmart";
    }
    if (val === "pix") {
      return "PIX";
    }
    if (val === "transferencia") {
      return "Transferência Bancária";
    }
    if (val === "cartao") {
      return "Cartão";
    }
    if (val === "boleto") {
      return "Boleto";
    }
  };

  return (
    <Paper className={classes.tableContainer}>
      <Table
        className={classes.fullWidth}
        size="small"
        aria-label="a dense table"
      >
        <TableHead>
          <TableRow>
            <TableCell align="center" style={{ width: "1%" }}>
              #
            </TableCell>
            <TableCell align="left">Nome/Documento</TableCell>
            <TableCell align="left">E-mail</TableCell>
            <TableCell align="left">Telefone</TableCell>
            <TableCell align="left">Forma de Pagamento</TableCell>
            <TableCell align="left">Status</TableCell>
            <TableCell align="left">Criada Em</TableCell>
            <TableCell align="left">Vencimento</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((row, key) => (
            <TableRow style={rowStyle(row)} key={key}>
              <TableCell align="center" style={{ width: "1%" }}>
                <IconButton onClick={() => onSelect(row)} aria-label="delete">
                  <EditIcon />
                </IconButton>
              </TableCell>
              <TableCell align="left">
                {row.name || "-"} <br />
                {row.document && (
                  <>
                    <b>{row.document}</b>
                  </>
                )}
              </TableCell>
              <TableCell align="left">{row.email || "-"}</TableCell>
              <TableCell align="left">{row.phone || "-"}</TableCell>
              <TableCell align="left">
                {row.paymentMethod && (
                  <>
                    <b>{getPaymentMethodValue(row.paymentMethod)}</b>
                  </>
                )}
              </TableCell>
              <TableCell align="left">{renderStatus(row)}</TableCell>
              <TableCell align="left">{dateToClient(row.createdAt)}</TableCell>
              <TableCell align="left">
                {dateToClient(row.dueDate)}
                <br />
                <span>{row.recurrence}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function CompaniesManager() {
  const classes = useStyles();
  const { list, save, update, remove } = useCompanies();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    status: true,
    dueDate: "",
    recurrence: "",
    document: "",
    paymentMethod: "",
    archived: false,
    archivedAt: "",
  });
  const [showArchived, setShowArchived] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");

  const filteredCompanies = records.filter((c) => c.archived === showArchived);

  const listOfCompanies =
    companyFilter === ""
      ? filteredCompanies
      : filteredCompanies.filter(
          (c) =>
            c.name.toLowerCase().indexOf(companyFilter.toLocaleLowerCase()) >
              -1 ||
            c.email.toLowerCase().indexOf(companyFilter.toLocaleLowerCase()) >
              -1
        );

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const companyList = await list();
      setRecords(companyList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoading(false);
  };

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      if (data.id !== undefined) {
        await update(data);
      } else {
        await save(data);
      }
      await loadCompanies();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await remove(record.id);
      await loadCompanies();
      handleCancel();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleOpenDeleteDialog = () => {
    setShowConfirmDialog(true);
  };

  const handleCancel = () => {
    setRecord((prev) => ({
      ...prev,
      id: "",
      name: "",
      email: "",
      phone: "",
      status: true,
      dueDate: "",
      recurrence: "",
      document: "",
      paymentMethod: "",
      archived: false,
      archivedAt: "",
    }));
  };

  const handleSelect = (data) => {
    setRecord((prev) => ({
      ...prev,
      id: data.id,
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      status: data.status === false ? false : true,
      dueDate: data.dueDate || "",
      recurrence: data.recurrence || "",
      document: data.document || "",
      paymentMethod: data.paymentMethod || "",
      archived: data.archived === false ? false : true,
      archivedAt: data.archivedAt || "",
    }));
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await api.patch(`/companies/archived/${record.id}`, {
        archived: !record.archived,
      });
      handleCancel();
      await loadCompanies();
      toast.success("Operação realizada com sucesso!");
    } catch (e) {
      toast.error("Não foi possível realizar a operação");
    }
    setLoading(false);
  };

  const handleSearchCompanyChanged = (val) => {
    setCompanyFilter(val);
  };

  return (
    <>
      <ConfirmationModal
        title="Arquivamento"
        open={showArchiveDialog}
        onClose={() => setShowArchiveDialog(false)}
        onConfirm={() => handleArchive()}
      >
        Deseja realmente status de arquivamento desta empresa?
      </ConfirmationModal>
      <Paper className={classes.mainPaper} elevation={0}>
        <Grid spacing={2} container>
          <Grid xs={12} item>
            <CompanyForm
              initialValue={{ ...record }}
              onDelete={handleOpenDeleteDialog}
              onArchive={() => setShowArchiveDialog(true)}
              onFilterArchived={(val) => setShowArchived(val)}
              onSearchCompanyChanged={(val) => handleSearchCompanyChanged(val)}
              filterArchived={showArchived}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              loading={loading}
            />
          </Grid>
          <Grid xs={12} item>
            <CompaniesManagerGrid
              selected={record}
              records={listOfCompanies}
              onSelect={handleSelect}
            />
          </Grid>
        </Grid>
        <ConfirmationModal
          title="Exclusão de Registro"
          open={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={() => handleDelete()}
        >
          Deseja realmente excluir esse registro?
        </ConfirmationModal>
      </Paper>
    </>
  );
}
