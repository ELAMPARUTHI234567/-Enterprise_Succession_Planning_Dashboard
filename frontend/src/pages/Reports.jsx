import React, { useEffect, useState } from 'react';
import { FileText, Download, Printer, RefreshCw, Eye } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { reportService } from '../services/api';

export const Reports = () => {
  const [reportsData, setReportsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('readiness');

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const res = await reportService.getSummary();
      if (res.success) {
        setReportsData(res.data);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, []);

  const handleExportCsv = (type) => {
    const url = reportService.getExportUrl(type);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Executive Succession Reports &amp; Export</h2>
          <p className="text-xs text-slate-500 mt-0.5">Generate printable reports and download CSV data exports</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
          <button
            onClick={() => handleExportCsv(selectedType)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Cards Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { type: 'readiness', title: 'Successor Readiness Report', desc: 'Weighted readiness scores, levels, & major gaps' },
          { type: 'gaps', title: 'Competency Gap Report', desc: 'Required target scores minus current ratings' },
          { type: 'employees', title: 'Employee Directory Report', desc: 'Workforce demographics and experience details' },
          { type: 'pipeline', title: 'Leadership Pipeline Summary', desc: 'High readiness successor candidate summary' }
        ].map((rpt) => (
          <div
            key={rpt.type}
            onClick={() => setSelectedType(rpt.type)}
            className={`p-4 rounded-xl border transition-all cursor-pointer card-shadow ${
              selectedType === rpt.type
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleExportCsv(rpt.type); }}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Download CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mt-3">{rpt.title}</h3>
            <p className="text-[10px] text-slate-500 mt-1">{rpt.desc}</p>
          </div>
        ))}
      </div>

      {/* Printable Report Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {selectedType.toUpperCase()} REPORT PREVIEW
            </h3>
            <p className="text-[11px] text-slate-500">Live backend database report table</p>
          </div>
          <button
            onClick={() => handleExportCsv(selectedType)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-xs hover:bg-emerald-100 transition-colors flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-500">Loading Report...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Employee Name</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Experience</th>
                  <th className="px-6 py-3.5">Competency Score</th>
                  <th className="px-6 py-3.5">Readiness Score</th>
                  <th className="px-6 py-3.5">Readiness Level</th>
                  <th className="px-6 py-3.5">Major Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {reportsData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-500">{item.employee_code}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600">{item.department}</td>
                    <td className="px-6 py-4 text-slate-800">{item.designation}</td>
                    <td className="px-6 py-4">{item.experience_years} Yrs</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{item.overall_competency_score}%</td>
                    <td className="px-6 py-4 font-extrabold text-indigo-700">{item.readiness_score}%</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={item.readiness_level} type="readiness" />
                    </td>
                    <td className="px-6 py-4 text-rose-600 font-semibold">{item.major_gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
