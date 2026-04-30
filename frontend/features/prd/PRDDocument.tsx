
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import type {
  PRDExportData,
  PRDGoal,
  PRDFeature,
  PRDTask,
  PRDMetric,
  PRDArchitecture,
} from './types';

// Design tokens
const C = {
  primary: '#e4611a',
  text: '#0d0d0d',
  muted: '#6b6b6b',
  border: '#e4ddd4',
  surface: '#f7f4f0',
  white: '#ffffff',
  headerBg: '#1d1a16',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.text,
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
    backgroundColor: C.white,
  },
  // Cover page
  coverPage: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.text,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: C.headerBg,
    display: 'flex',
    flexDirection: 'column',
  },
  coverAccentBar: {
    height: 5,
    backgroundColor: C.primary,
    width: '100%',
  },
  coverContent: {
    flex: 1,
    paddingHorizontal: 56,
    paddingTop: 160,
    paddingBottom: 80,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  coverLabel: {
    fontSize: 9,
    color: C.primary,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  coverTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 38,
    color: '#f0ece5',
    lineHeight: 1.15,
    marginBottom: 16,
  },
  coverSubtitle: {
    fontFamily: 'Times-Roman',
    fontSize: 14,
    color: '#b0aa9f',
    marginBottom: 48,
  },
  coverMeta: {
    fontSize: 9,
    color: '#6b6360',
    fontFamily: 'Helvetica',
    letterSpacing: 0.5,
  },
  // Section header
  sectionHeaderContainer: {
    marginTop: 24,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 5,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionAccent: {
    width: 3,
    height: 12,
    backgroundColor: C.primary,
    marginRight: 8,
    borderRadius: 1,
  },
  sectionTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 13,
    color: C.text,
  },
  // Body text
  bodyText: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.text,
    lineHeight: 1.6,
    marginBottom: 6,
  },
  // Goals table
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 5,
  },
  tableHeaderRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.text,
    paddingVertical: 5,
    backgroundColor: C.surface,
  },
  tableCellLeft: {
    flex: 2,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
    paddingRight: 8,
  },
  tableCellRight: {
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: C.primary,
    textAlign: 'right',
  },
  tableCellHeader: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Architecture
  archContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  archBlock: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: C.surface,
  },
  archLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  archValue: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    lineHeight: 1.5,
  },
  // Features & tasks
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  listNumber: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    color: C.primary,
    width: 22,
    flexShrink: 0,
    paddingTop: 1,
  },
  listContent: {
    flex: 1,
  },
  listItemTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: C.text,
    marginBottom: 2,
  },
  listItemDesc: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: '#3a3530',
    lineHeight: 1.5,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 3,
  },
  priorityText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.muted,
  },
  footerRight: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.muted,
  },
});

// Helpers
function archStr(val: string | string[] | undefined): string {
  if (!val) return '—';
  return Array.isArray(val) ? val.join('\n') : String(val);
}

function priorityColor(priority?: string): string {
  const p = (priority ?? '').toLowerCase();
  if (p === 'high' || p === 'critical') return '#e4611a';
  if (p === 'medium' || p === 'med') return '#b08040';
  return '#6b8a6b';
}

function toStringLines(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return val.split('\n').filter(Boolean);
  if (typeof val === 'object') return [JSON.stringify(val, null, 2)];
  return [String(val)];
}

// Sub-components
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function GoalsTable({ goals }: { goals: PRDGoal[] | string | undefined }) {
  if (!goals) return null;
  if (typeof goals === 'string') {
    return <Text style={styles.bodyText}>{goals}</Text>;
  }
  return (
    <View>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableCellLeft, styles.tableCellHeader]}>Metric</Text>
        <Text style={[styles.tableCellRight, styles.tableCellHeader]}>Target</Text>
      </View>
      {goals.map((g, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.tableCellLeft}>{g.metric ?? '—'}</Text>
          <Text style={styles.tableCellRight}>{g.target ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function ArchitectureBlock({ arch }: { arch: PRDArchitecture | undefined }) {
  if (!arch) return null;
  const layers: { label: string; key: keyof PRDArchitecture }[] = [
    { label: 'Frontend', key: 'frontend' },
    { label: 'Backend', key: 'backend' },
    { label: 'Data', key: 'data' },
  ];
  return (
    <View style={styles.archContainer}>
      {layers.map(({ label, key }) => (
        <View key={key} style={styles.archBlock}>
          <Text style={styles.archLabel}>{label}</Text>
          <Text style={styles.archValue}>{archStr(arch[key])}</Text>
        </View>
      ))}
    </View>
  );
}

function MetricsTable({ metrics }: { metrics: PRDMetric[] | string | undefined }) {
  if (!metrics) return null;
  if (typeof metrics === 'string') {
    return <Text style={styles.bodyText}>{metrics}</Text>;
  }
  return (
    <View>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableCellLeft, styles.tableCellHeader]}>Metric</Text>
        <Text style={[styles.tableCellRight, styles.tableCellHeader]}>Target</Text>
      </View>
      {metrics.map((m, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.tableCellLeft}>{m.metric ?? '—'}</Text>
          <Text style={styles.tableCellRight}>{m.target ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function FeaturesList({ features }: { features: PRDFeature[] | undefined }) {
  if (!features || features.length === 0) return null;
  return (
    <View>
      {features.map((f, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={styles.listNumber}>{i + 1}.</Text>
          <View style={styles.listContent}>
            <Text style={styles.listItemTitle}>{f.name ?? 'Untitled'}</Text>
            {f.description ? (
              <Text style={styles.listItemDesc}>{f.description}</Text>
            ) : null}
            {f.priority ? (
              <View style={[styles.priorityBadge, { backgroundColor: priorityColor(f.priority) + '22' }]}>
                <Text style={[styles.priorityText, { color: priorityColor(f.priority) }]}>
                  {f.priority}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function TasksList({ tasks }: { tasks: PRDTask[] | undefined }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <View>
      {tasks.map((t, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={styles.listNumber}>{i + 1}.</Text>
          <View style={styles.listContent}>
            <Text style={styles.listItemTitle}>{t.title ?? 'Untitled'}</Text>
            {(t.type || t.priority) ? (
              <Text style={[styles.listItemDesc, { color: C.muted, fontSize: 8.5 }]}>
                {[t.type, t.priority].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {t.description ? (
              <Text style={styles.listItemDesc}>{t.description}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function GenericSection({ val }: { val: unknown }) {
  const lines = toStringLines(val);
  return (
    <View>
      {lines.map((line, i) => (
        <Text key={i} style={styles.bodyText}>{line}</Text>
      ))}
    </View>
  );
}

function PageFooter({ productName }: { productName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>{productName} — Product Requirements Document</Text>
      <Text
        style={styles.footerRight}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

// Main Document
interface PRDDocumentProps {
  data: PRDExportData;
  generatedAt: string;
}

export function PRDDocument({ data, generatedAt }: PRDDocumentProps) {
  const productName = data.product_name ?? 'Product';

  return (
    <Document
      title={`${productName} — Product Requirements Document`}
      author="SpecFlow"
      subject="PRD"
    >
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverAccentBar} />
        <View style={styles.coverContent}>
          <View>
            <Text style={styles.coverLabel}>SpecFlow · PRD</Text>
            <Text style={styles.coverTitle}>{productName}</Text>
            <Text style={styles.coverSubtitle}>Product Requirements Document</Text>
          </View>
          <Text style={styles.coverMeta}>Generated {generatedAt}</Text>
        </View>
      </Page>

      {/* Content Pages */}
      <Page size="A4" style={styles.page}>
        <PageFooter productName={productName} />

        {/* Executive Summary */}
        {data.executive_summary ? (
          <View>
            <SectionHeader title="Executive Summary" />
            <Text style={styles.bodyText}>{data.executive_summary}</Text>
          </View>
        ) : null}

        {/* Problem Statement */}
        {data.problem_statement ? (
          <View>
            <SectionHeader title="Problem Statement" />
            <Text style={styles.bodyText}>{data.problem_statement}</Text>
          </View>
        ) : null}

        {/* Goals */}
        {data.goals ? (
          <View>
            <SectionHeader title="Goals" />
            <GoalsTable goals={data.goals as PRDGoal[] | string} />
          </View>
        ) : null}

        {/* Architecture */}
        {data.architecture ? (
          <View>
            <SectionHeader title="Architecture" />
            <ArchitectureBlock arch={data.architecture} />
          </View>
        ) : null}

        {/* Features */}
        {data.features && data.features.length > 0 ? (
          <View>
            <SectionHeader title="Features" />
            <FeaturesList features={data.features} />
          </View>
        ) : null}

        {/* Implementation Plan */}
        {data.implementation_plan ? (
          <View>
            <SectionHeader title="Implementation Plan" />
            <GenericSection val={data.implementation_plan} />
          </View>
        ) : null}

        {/* Risks */}
        {data.risks ? (
          <View>
            <SectionHeader title="Risks" />
            <GenericSection val={data.risks} />
          </View>
        ) : null}

        {/* Tasks */}
        {data.tasks && data.tasks.length > 0 ? (
          <View>
            <SectionHeader title="Tasks" />
            <TasksList tasks={data.tasks} />
          </View>
        ) : null}

        {/* Success Metrics */}
        {data.success_metrics ? (
          <View>
            <SectionHeader title="Success Metrics" />
            <MetricsTable metrics={data.success_metrics as PRDMetric[] | string} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
