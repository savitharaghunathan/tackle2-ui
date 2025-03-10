import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Button,
  ButtonVariant,
  Modal,
  PageSection,
  Popover,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { DropdownItem } from "@patternfly/react-core/deprecated";
import {
  cellWidth,
  IAction,
  ICell,
  IRow,
  IRowData,
  ISeparator,
  sortable,
  truncate,
} from "@patternfly/react-table";

import { IconedStatus } from "@app/components/IconedStatus";
import { ConfirmDialog } from "@app/components/ConfirmDialog";
import { Paths } from "@app/Paths";
import { ApplicationImportSummary } from "@app/api/models";
import { formatDate, formatPath } from "@app/utils/utils";
import { ImportApplicationsForm } from "../components/import-applications-form";
import { useLegacyPaginationState } from "@app/hooks/useLegacyPaginationState";
import {
  useDeleteImportSummaryMutation,
  useFetchImportSummaries,
} from "@app/queries/imports";
import { useLegacyFilterState } from "@app/hooks/useLegacyFilterState";
import {
  FilterCategory,
  FilterToolbar,
  FilterType,
} from "@app/components/FilterToolbar/FilterToolbar";
import { useLegacySortState } from "@app/hooks/useLegacySortState";
import TooltipTitle from "@app/components/TooltipTitle";
import { NotificationsContext } from "@app/components/NotificationsContext";
import { PageHeader } from "@app/components/PageHeader";
import { ConditionalRender } from "@app/components/ConditionalRender";
import { AppPlaceholder } from "@app/components/AppPlaceholder";
import { AppTableWithControls } from "@app/components/AppTableWithControls";
import { KebabDropdown } from "@app/components/KebabDropdown";

const ENTITY_FIELD = "entity";

const getRow = (rowData: IRowData): ApplicationImportSummary => {
  return rowData[ENTITY_FIELD];
};

export const ManageImports: React.FC = () => {
  // i18
  const { t } = useTranslation();

  const [importSummaryToDelete, setImportSummaryToDelete] =
    React.useState<ApplicationImportSummary>();

  const { pushNotification } = React.useContext(NotificationsContext);

  // Router
  const history = useHistory();

  const { importSummaries, isFetching, fetchError, refetch } =
    useFetchImportSummaries();

  // Application import modal
  const [isApplicationImportModalOpen, setIsApplicationImportModalOpen] =
    useState(false);

  // Delete

  const onDeleteImportSummarySuccess = () => {
    pushNotification({
      title: t("terms.importSummaryDeleted"),
      variant: "success",
    });
  };

  const onDeleteImportSummaryError = (error: Error | null) => {
    if (error)
      pushNotification({
        title: error.message,
        variant: "danger",
      });
  };

  const { mutate: deleteImportSummary } = useDeleteImportSummaryMutation(
    onDeleteImportSummarySuccess,
    onDeleteImportSummaryError
  );

  const filterCategories: FilterCategory<
    ApplicationImportSummary,
    "filename"
  >[] = [
    {
      key: "filename",
      title: "File Name",
      type: FilterType.search,
      placeholderText: "Filter by filename...",
      getItemValue: (item) => {
        return item?.filename || "";
      },
    },
  ];

  const { filterValues, setFilterValues, filteredItems } = useLegacyFilterState(
    importSummaries || [],
    filterCategories
  );

  const getSortValues = (item: ApplicationImportSummary) => [
    item?.importTime,
    item?.createUser.toLowerCase(),
    item?.filename?.toLowerCase() || "",
    item?.importStatus,
    "", // Action column
  ];

  const { sortBy, onSort, sortedItems } = useLegacySortState(
    filteredItems,
    getSortValues
  );

  const { currentPageItems, setPageNumber, paginationProps } =
    useLegacyPaginationState(sortedItems, 10);

  // Table
  const columns: ICell[] = [
    {
      title: t("terms.date"),
      transforms: [sortable, cellWidth(25)],
    },
    {
      title: t("terms.user"),
      transforms: [sortable, cellWidth(15)],
      cellTransforms: [truncate],
    },
    {
      title: t("terms.filename"),
      transforms: [sortable, cellWidth(30)],
      cellTransforms: [truncate],
    },
    {
      title: t("terms.status"),
      transforms: [sortable, cellWidth(10)],
      cellTransforms: [truncate],
    },
    {
      title: (
        <TooltipTitle
          titleText={t("terms.accepted")}
          tooltipText={t("terms.acceptedAppsAndDeps")}
        ></TooltipTitle>
      ),
      transforms: [cellWidth(10)],
    },
    {
      title: (
        <TooltipTitle
          titleText={t("terms.rejected")}
          tooltipText={t("terms.rejectedAppsAndDeps")}
        ></TooltipTitle>
      ),
      transforms: [cellWidth(10)],
    },
  ];

  const rows: IRow[] = [];
  currentPageItems.forEach((item) => {
    let status;
    if (item.importStatus === "Completed") {
      status = <IconedStatus preset="Completed" />;
    } else if (item.importStatus === "In Progress") {
      status = <IconedStatus preset="InProgress" />;
    } else {
      status = (
        <IconedStatus
          preset="Error"
          label={
            <Popover
              position="right"
              bodyContent={
                <div>{t("message.importErrorCheckDocumentation")}</div>
              }
              footerContent={
                <div>
                  <a
                    href="https://tackle-docs.konveyor.io/documentation/doc-installing-and-using-tackle/master/index.html#importing-applications_tackle"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("actions.checkDocumentation")}
                  </a>
                </div>
              }
            >
              <Button variant={ButtonVariant.link} isInline>
                {t("terms.error")}
              </Button>
            </Popover>
          }
        />
      );
    }

    rows.push({
      [ENTITY_FIELD]: item,
      cells: [
        {
          title: item.importTime ? formatDate(new Date(item.importTime)) : "",
        },
        {
          title: item.createUser,
        },
        {
          title: item.filename,
        },
        {
          title: status,
        },
        {
          title: item.validCount,
        },
        {
          title: item.invalidCount,
        },
      ],
    });
  });

  const actionResolver = (rowData: IRowData): (IAction | ISeparator)[] => {
    const row: ApplicationImportSummary = getRow(rowData);
    if (!row) {
      return [];
    }

    const actions: (IAction | ISeparator)[] = [];
    actions.push({
      title: t("actions.delete"),
      onClick: (
        event: React.MouseEvent,
        rowIndex: number,
        rowData: IRowData
      ) => {
        const row: ApplicationImportSummary = getRow(rowData);
        deleteRow(row);
      },
    });

    if (row.importStatus === "Completed" && row.invalidCount > 0) {
      actions.push({
        title: t("actions.viewErrorReport"),
        onClick: (
          event: React.MouseEvent,
          rowIndex: number,
          rowData: IRowData
        ) => {
          const row: ApplicationImportSummary = getRow(rowData);
          viewRowDetails(row);
        },
      });
    }

    return actions;
  };

  // Row actions
  const deleteRow = (row: ApplicationImportSummary) => {
    setImportSummaryToDelete(row);
  };

  const viewRowDetails = (row: ApplicationImportSummary) => {
    history.push(
      formatPath(Paths.applicationsImportsDetails, {
        importId: row.id,
      })
    );
  };

  const handleOnClearAllFilters = () => {
    setFilterValues({});
  };

  return (
    <>
      <PageSection variant="light">
        <PageHeader
          title={t("terms.applicationImports")}
          breadcrumbs={[
            {
              title: t("terms.applications"),
              path: Paths.applications,
            },
            {
              title: t("terms.applicationImports"),
              path: "",
            },
          ]}
          menuActions={[]}
        />
      </PageSection>
      <PageSection>
        <ConditionalRender
          when={isFetching && !(importSummaries || fetchError)}
          then={<AppPlaceholder />}
        >
          <AppTableWithControls
            count={importSummaries ? importSummaries.length : 0}
            paginationProps={paginationProps}
            paginationIdPrefix="manage-imports"
            sortBy={sortBy}
            onSort={onSort}
            cells={columns}
            rows={rows}
            actionResolver={actionResolver}
            isLoading={isFetching}
            loadingVariant="skeleton"
            fetchError={fetchError}
            toolbarClearAllFilters={handleOnClearAllFilters}
            toolbarToggle={
              <FilterToolbar
                filterCategories={filterCategories}
                filterValues={filterValues}
                setFilterValues={setFilterValues}
              />
            }
            toolbarActions={
              <>
                <ToolbarGroup variant="button-group">
                  <ToolbarItem>
                    <Button
                      type="button"
                      id="import-applications"
                      aria-label="Import Applications"
                      variant={ButtonVariant.primary}
                      onClick={() => setIsApplicationImportModalOpen(true)}
                    >
                      {t("actions.import")}
                    </Button>
                  </ToolbarItem>
                  <ToolbarItem>
                    <KebabDropdown
                      dropdownItems={[
                        <DropdownItem
                          key="download-csv-template"
                          component={
                            <a href="/template_application_import.csv" download>
                              {t("actions.downloadCsvTemplate")}
                            </a>
                          }
                        />,
                      ]}
                    />
                  </ToolbarItem>
                </ToolbarGroup>
              </>
            }
          />
        </ConditionalRender>
      </PageSection>

      <Modal
        isOpen={isApplicationImportModalOpen}
        variant="medium"
        title={t("dialog.title.importApplicationFile")}
        onClose={() => setIsApplicationImportModalOpen((current) => !current)}
      >
        <ImportApplicationsForm
          onSaved={() => {
            setIsApplicationImportModalOpen(false);
            refetch();
          }}
        />
      </Modal>
      {!!importSummaryToDelete && (
        <ConfirmDialog
          title={t("dialog.title.deleteWithName", {
            what: "import summary",
            name: importSummaryToDelete.filename,
          })}
          titleIconVariant={"warning"}
          message={t("dialog.message.delete")}
          isOpen={true}
          confirmBtnVariant={ButtonVariant.danger}
          confirmBtnLabel={t("actions.delete")}
          cancelBtnLabel={t("actions.cancel")}
          onCancel={() => setImportSummaryToDelete(undefined)}
          onClose={() => setImportSummaryToDelete(undefined)}
          onConfirm={() => {
            if (importSummaryToDelete) {
              deleteImportSummary(importSummaryToDelete.id);
              setImportSummaryToDelete(undefined);
            }
          }}
        />
      )}
    </>
  );
};
