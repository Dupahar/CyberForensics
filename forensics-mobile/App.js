import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';

// API Configuration - Update this to your server's IP address
const API_BASE_URL = 'http://192.168.1.100:8001';  // Change this to your computer's IP

const api = {
  async createCase(caseData) {
    const response = await fetch(`${API_BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(caseData)
    });
    return response.json();
  },
  
  async getCases() {
    const response = await fetch(`${API_BASE_URL}/api/cases`);
    return response.json();
  },
  
  async uploadEvidence(caseId, fileUri, fileName) {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'application/octet-stream',
      name: fileName,
    });
    
    const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.json();
  },
  
  async getCaseEvidence(caseId) {
    const response = await fetch(`${API_BASE_URL}/api/cases/${caseId}/evidence`);
    return response.json();
  },
  
  async exportData(exportRequest) {
    const response = await fetch(`${API_BASE_URL}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportRequest)
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition ? 
        contentDisposition.split('filename=')[1].replace(/"/g, '') : 
        'forensics_export.json';
      
      // Save to device downloads
      const downloadUri = FileSystem.documentDirectory + filename;
      const reader = new FileReader();
      reader.onload = async () => {
        await FileSystem.writeAsStringAsync(downloadUri, reader.result, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        Alert.alert('Export Complete', `File saved as ${filename}`);
      };
      reader.readAsText(blob);
      
      return { success: true, hash: response.headers.get('X-Export-Hash') };
    }
    
    throw new Error('Export failed');
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      const response = await api.getCases();
      setCases(response.cases || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load cases: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCases();
    setRefreshing(false);
  };

  const createCase = async () => {
    Alert.prompt(
      'Create New Case',
      'Enter case details:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (input) => {
            try {
              setLoading(true);
              const [caseName, investigator] = input.split('\n');
              const response = await api.createCase({
                case_name: caseName || 'Mobile Forensics Case',
                investigator: investigator || 'Mobile Investigator',
                description: 'Created from mobile app'
              });
              if (response.success) {
                await loadCases();
                Alert.alert('Success', 'Case created successfully');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to create case: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ],
      'plain-text',
      'Case Name\nInvestigator Name'
    );
  };

  const selectEvidence = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/octet-stream', 'application/x-sqlite3', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setLoading(true);
        
        try {
          const response = await api.uploadEvidence(
            selectedCase.case_id,
            file.uri,
            file.name
          );
          
          if (response.success) {
            Alert.alert(
              'Evidence Processed',
              `Extracted:\n` +
              `• ${response.summary.messages_count} Messages\n` +
              `• ${response.summary.contacts_count} Contacts\n` +
              `• ${response.summary.call_logs_count} Call Logs`
            );
            await loadCaseEvidence();
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to process evidence: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select file: ' + error.message);
    }
  };

  const loadCaseEvidence = async () => {
    if (!selectedCase) return;
    
    try {
      const response = await api.getCaseEvidence(selectedCase.case_id);
      setEvidence(response.evidence || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load evidence: ' + error.message);
    }
  };

  const exportData = async (dataTypes, format = 'json') => {
    if (!selectedCase) return;
    
    try {
      setLoading(true);
      await api.exportData({
        case_id: selectedCase.case_id,
        data_types: dataTypes,
        export_format: format
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to export data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDashboard = () => (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <MaterialIcons name="security" size={32} color="#1e3a8a" />
        <Text style={styles.title}>CyberForensics Mobile</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={createCase}>
        <MaterialIcons name="add" size={24} color="white" />
        <Text style={styles.buttonText}>Create New Case</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Forensics Cases</Text>
      
      {loading && <ActivityIndicator size="large" color="#1e3a8a" />}
      
      {cases.map((case_item) => (
        <TouchableOpacity
          key={case_item.case_id}
          style={styles.caseCard}
          onPress={() => {
            setSelectedCase(case_item);
            setCurrentView('case-detail');
            loadCaseEvidence();
          }}
        >
          <View style={styles.caseHeader}>
            <Text style={styles.caseName}>{case_item.case_name}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{case_item.status}</Text>
            </View>
          </View>
          <Text style={styles.caseInvestigator}>
            Investigator: {case_item.investigator}
          </Text>
          <Text style={styles.caseDate}>
            Created: {new Date(case_item.created_at).toLocaleDateString()}
          </Text>
        </TouchableOpacity>
      ))}

      {cases.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <MaterialIcons name="folder-open" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No cases found</Text>
          <Text style={styles.emptySubtext}>Create your first forensics case</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderCaseDetail = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setCurrentView('dashboard')}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.title}>{selectedCase?.case_name}</Text>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.primaryButton} onPress={selectEvidence}>
          <MaterialIcons name="upload-file" size={24} color="white" />
          <Text style={styles.buttonText}>Upload Evidence</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Evidence Files</Text>
      
      {evidence.map((ev) => (
        <View key={ev.evidence_id} style={styles.evidenceCard}>
          <Text style={styles.evidenceFileName}>{ev.filename}</Text>
          <View style={styles.evidenceStats}>
            <View style={styles.statItem}>
              <MaterialIcons name="message" size={16} color="#6b7280" />
              <Text style={styles.statText}>{ev.summary?.messages_count || 0} Messages</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="contacts" size={16} color="#6b7280" />
              <Text style={styles.statText}>{ev.summary?.contacts_count || 0} Contacts</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="call" size={16} color="#6b7280" />
              <Text style={styles.statText}>{ev.summary?.call_logs_count || 0} Calls</Text>
            </View>
          </View>
          <Text style={styles.hashText}>
            SHA-512: {ev.file_hash?.substring(0, 16)}...
          </Text>
        </View>
      ))}

      {evidence.length > 0 && (
        <View style={styles.exportSection}>
          <Text style={styles.sectionTitle}>Export Data</Text>
          
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => exportData(['messages', 'contacts', 'call_logs'], 'json')}
          >
            <MaterialIcons name="download" size={24} color="white" />
            <Text style={styles.buttonText}>Export All (JSON)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => exportData(['messages'], 'json')}
          >
            <MaterialIcons name="message" size={24} color="white" />
            <Text style={styles.buttonText}>Export Messages</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => exportData(['contacts'], 'json')}
          >
            <MaterialIcons name="contacts" size={24} color="white" />
            <Text style={styles.buttonText}>Export Contacts</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => exportData(['call_logs'], 'json')}
          >
            <MaterialIcons name="call" size={24} color="white" />
            <Text style={styles.buttonText}>Export Call Logs</Text>
          </TouchableOpacity>
        </View>
      )}

      {evidence.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="insert-drive-file" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No evidence uploaded</Text>
          <Text style={styles.emptySubtext}>Upload database files to extract data</Text>
        </View>
      )}

      {loading && <ActivityIndicator size="large" color="#1e3a8a" />}
    </ScrollView>
  );

  return (
    <View style={styles.app}>
      <StatusBar style="auto" />
      {currentView === 'dashboard' ? renderDashboard() : renderCaseDetail()}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: Constants.statusBarHeight + 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginVertical: 16,
  },
  primaryButton: {
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  exportButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  caseCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  caseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  caseInvestigator: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  caseDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  evidenceCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  evidenceFileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  evidenceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  hashText: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  actionButtons: {
    marginBottom: 16,
  },
  exportSection: {
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
});