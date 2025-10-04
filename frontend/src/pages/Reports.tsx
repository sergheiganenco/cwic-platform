import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  Clock,
  Download,
  Send,
  Settings,
  ChevronRight,
  Filter,
  Search,
  MoreVertical,
  Eye,
  Edit2,
  Copy,
  Trash2,
  Mail,
  MessageSquare,
  Globe,
  CheckCircle,
  AlertCircle,
  XCircle,
  BarChart3,
  FileSpreadsheet,
  FileJson,
  Users,
  Tag,
  Folder,
} from 'lucide-react';

interface Report {
  id: string;
  name: string;
  type: 'dashboard' | 'analytical' | 'operational' | 'compliance';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  status: 'draft' | 'active' | 'scheduled' | 'paused';
  schedule?: string;
  lastRun?: string;
  nextRun?: string;
  recipients?: number;
  owner: string;
  category: string;
  tags: string[];
}

const mockReports: Report[] = [
  {
    id: '1',
    name: 'Monthly Data Quality Report',
    type: 'analytical',
    format: 'pdf',
    status: 'active',
    schedule: 'Monthly',
    lastRun: '2024-01-01 09:00',
    nextRun: '2024-02-01 09:00',
    recipients: 12,
    owner: 'Sarah Chen',
    category: 'Data Quality',
    tags: ['monthly', 'executive', 'quality'],
  },
  {
    id: '2',
    name: 'Weekly Pipeline Performance',
    type: 'operational',
    format: 'excel',
    status: 'scheduled',
    schedule: 'Weekly',
    lastRun: '2024-01-08 06:00',
    nextRun: '2024-01-15 06:00',
    recipients: 8,
    owner: 'Mike Wilson',
    category: 'Operations',
    tags: ['weekly', 'pipelines', 'performance'],
  },
  {
    id: '3',
    name: 'Compliance Audit Trail',
    type: 'compliance',
    format: 'csv',
    status: 'active',
    schedule: 'Daily',
    lastRun: '2024-01-14 23:00',
    nextRun: '2024-01-15 23:00',
    recipients: 5,
    owner: 'Lisa Johnson',
    category: 'Compliance',
    tags: ['daily', 'audit', 'compliance'],
  },
  {
    id: '4',
    name: 'Executive Dashboard Export',
    type: 'dashboard',
    format: 'pdf',
    status: 'paused',
    schedule: 'Weekly',
    lastRun: '2024-01-01 08:00',
    owner: 'David Kim',
    category: 'Executive',
    tags: ['dashboard', 'executive'],
  },
];

export const Reports: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'paused':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'draft':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
      case 'csv':
        return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <FileJson className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredReports = mockReports.filter(report => {
    const matchesType = filterType === 'all' || report.type === filterType;
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          report.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          report.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create, schedule, and distribute reports across your organization
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{mockReports.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Schedules</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {mockReports.filter(r => r.status === 'active' || r.status === 'scheduled').length}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Recipients</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {mockReports.reduce((acc, r) => acc + (r.recipients || 0), 0)}
              </p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Next Scheduled</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">3</p>
              <p className="text-xs text-gray-500 mt-1">In next 24h</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="dashboard">Dashboard</option>
            <option value="analytical">Analytical</option>
            <option value="operational">Operational</option>
            <option value="compliance">Compliance</option>
          </select>
          <button className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4 mr-2" />
            More Filters
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => setSelectedReport(report)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {getFormatIcon(report.format)}
                  <div>
                    <h3 className="font-medium text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{report.category}</p>
                  </div>
                </div>
                <div className="relative group">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 hidden group-hover:block z-10">
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Eye className="h-3 w-3" /> View
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <Copy className="h-3 w-3" /> Duplicate
                    </button>
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(report.status)}
                    <span className="capitalize">{report.status}</span>
                  </div>
                </div>
                {report.schedule && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Schedule</span>
                    <span>{report.schedule}</span>
                  </div>
                )}
                {report.nextRun && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Next Run</span>
                    <span>{new Date(report.nextRun).toLocaleDateString()}</span>
                  </div>
                )}
                {report.recipients !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Recipients</span>
                    <span>{report.recipients}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex gap-1">
                  {report.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {report.tags.length > 2 && (
                    <span className="px-2 py-1 text-gray-500 text-xs">
                      +{report.tags.length - 2}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Send"
                  >
                    <Send className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Folder className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Report Templates</p>
                <p className="text-sm text-gray-500">Browse and manage templates</p>
              </div>
            </div>
          </button>
          <button className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Distribution Lists</p>
                <p className="text-sm text-gray-500">Manage recipient groups</p>
              </div>
            </div>
          </button>
          <button className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Report Settings</p>
                <p className="text-sm text-gray-500">Configure defaults and formats</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;