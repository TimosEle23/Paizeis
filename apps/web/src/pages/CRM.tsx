import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, DollarSign, FileText, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { clientSchema, dealSchema, invoiceSchema } from "@/lib/validationSchemas";
import Navbar from "@/components/Navbar";

const CRM = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("clients");

  // Client state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientNotes, setClientNotes] = useState("");

  // Deal state
  const [dealTitle, setDealTitle] = useState("");
  const [dealClientId, setDealClientId] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [dealStage, setDealStage] = useState("lead");
  const [dealCloseDate, setDealCloseDate] = useState("");

  // Invoice state
  const [invoiceClientId, setInvoiceClientId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("draft");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch deals
  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create client mutation
  const createClient = useMutation({
    mutationFn: async () => {
      // Validate input
      const validated = clientSchema.parse({
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        notes: clientNotes,
      });

      const { error } = await supabase.from('clients').insert({
        user_id: user!.id,
        name: validated.name,
        email: validated.email || null,
        phone: validated.phone || null,
        notes: validated.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: "Client created successfully" });
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setClientNotes("");
    },
    onError: (error: any) => {
      if (error.errors) {
        error.errors.forEach((err: any) => 
          toast({ title: "Validation Error", description: err.message, variant: "destructive" })
        );
      } else {
        toast({ title: "Failed to create client", description: error.message, variant: "destructive" });
      }
    },
  });

  // Create deal mutation
  const createDeal = useMutation({
    mutationFn: async () => {
      // Validate input
      const validated = dealSchema.parse({
        title: dealTitle,
        clientId: dealClientId,
        value: parseFloat(dealValue) || 0,
        stage: dealStage,
        expectedCloseDate: dealCloseDate,
      });

      const { error } = await supabase.from('deals').insert({
        user_id: user!.id,
        client_id: validated.clientId,
        title: validated.title,
        value: validated.value,
        stage: validated.stage,
        expected_close_date: validated.expectedCloseDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: "Deal created successfully" });
      setDealTitle("");
      setDealClientId("");
      setDealValue("");
      setDealStage("lead");
      setDealCloseDate("");
    },
    onError: (error: any) => {
      if (error.errors) {
        error.errors.forEach((err: any) => 
          toast({ title: "Validation Error", description: err.message, variant: "destructive" })
        );
      } else {
        toast({ title: "Failed to create deal", description: error.message, variant: "destructive" });
      }
    },
  });

  // Create invoice mutation
  const createInvoice = useMutation({
    mutationFn: async () => {
      // Validate input
      const validated = invoiceSchema.parse({
        clientId: invoiceClientId,
        amount: parseFloat(invoiceAmount) || 0,
        status: invoiceStatus,
        dueDate: invoiceDueDate,
      });

      const { error } = await supabase.from('invoices').insert({
        user_id: user!.id,
        client_id: validated.clientId,
        amount: validated.amount,
        status: validated.status,
        due_date: validated.dueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: "Invoice created successfully" });
      setInvoiceClientId("");
      setInvoiceAmount("");
      setInvoiceStatus("draft");
      setInvoiceDueDate("");
    },
    onError: (error: any) => {
      if (error.errors) {
        error.errors.forEach((err: any) => 
          toast({ title: "Validation Error", description: err.message, variant: "destructive" })
        );
      } else {
        toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
      }
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 pt-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">CRM Dashboard</h1>
          <p className="text-muted-foreground">Manage your clients, deals, and invoices</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deals.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {invoices.filter(inv => inv.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Clients</CardTitle>
                    <CardDescription>Manage your client relationships</CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Client
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Client</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea
                            id="notes"
                            value={clientNotes}
                            onChange={(e) => setClientNotes(e.target.value)}
                          />
                        </div>
                        <Button onClick={() => createClient.mutate()} className="w-full">
                          Create Client
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{client.phone}</TableCell>
                        <TableCell>{client.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Deals</CardTitle>
                    <CardDescription>Track your sales pipeline</CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Deal
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Deal</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="dealTitle">Title</Label>
                          <Input
                            id="dealTitle"
                            value={dealTitle}
                            onChange={(e) => setDealTitle(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dealClient">Client</Label>
                          <Select value={dealClientId} onValueChange={setDealClientId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="dealValue">Value</Label>
                          <Input
                            id="dealValue"
                            type="number"
                            value={dealValue}
                            onChange={(e) => setDealValue(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="dealStage">Stage</Label>
                          <Select value={dealStage} onValueChange={setDealStage}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="negotiation">Negotiation</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="dealCloseDate">Expected Close Date</Label>
                          <Input
                            id="dealCloseDate"
                            type="date"
                            value={dealCloseDate}
                            onChange={(e) => setDealCloseDate(e.target.value)}
                          />
                        </div>
                        <Button onClick={() => createDeal.mutate()} className="w-full">
                          Create Deal
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Close Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">{deal.title}</TableCell>
                        <TableCell>{deal.clients?.name}</TableCell>
                        <TableCell>€{deal.value}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{deal.stage}</Badge>
                        </TableCell>
                        <TableCell>{deal.expected_close_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>Manage your billing</CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Invoice
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Invoice</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="invoiceClient">Client</Label>
                          <Select value={invoiceClientId} onValueChange={setInvoiceClientId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="invoiceAmount">Amount</Label>
                          <Input
                            id="invoiceAmount"
                            type="number"
                            value={invoiceAmount}
                            onChange={(e) => setInvoiceAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="invoiceStatus">Status</Label>
                          <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="invoiceDueDate">Due Date</Label>
                          <Input
                            id="invoiceDueDate"
                            type="date"
                            value={invoiceDueDate}
                            onChange={(e) => setInvoiceDueDate(e.target.value)}
                          />
                        </div>
                        <Button onClick={() => createInvoice.mutate()} className="w-full">
                          Create Invoice
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.clients?.name}</TableCell>
                        <TableCell>€{invoice.amount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.status}</Badge>
                        </TableCell>
                        <TableCell>{invoice.due_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CRM;
