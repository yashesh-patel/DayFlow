import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployee } from "@/contexts/EmployeeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Building,
  Calendar,
  MapPin,
  Briefcase,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import PasswordRequirements from "@/components/PasswordRequirements";
import { getPasswordError } from "@/lib/password";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

// Must satisfy the shared password rule -- the backend rejects anything weaker,
// so a seed value that fails validation would break employee creation outright.
const DEFAULT_EMPLOYEE_PASSWORD = "Welcome@123";

const departmentColors: Record<string, string> = {
  "Human Resources": "bg-[#fbe3d9] text-[#9f4a30] border border-[#f2bda9]",
  Engineering: "bg-[#fff2ea] text-[#af5a3b] border border-[#f7cdbd]",
  Marketing: "bg-[#ffeade] text-[#b5532f] border border-[#f7c1ad]",
  Design: "bg-[#ffe6d7] text-[#bc5b37] border border-[#f7c2ad]",
  Sales: "bg-[#fff5ef] text-[#a15035] border border-[#f4d2c3]",
  Finance: "bg-[#fff8f3] text-[#a85f40] border border-[#efd6ca]",
};

const Employees = () => {
  const { user } = useAuth();
  const {
    employees,
    isLoading,
    fetchEmployees,
    addEmployee: apiAddEmployee,
  } = useEmployee();
  const isHr = user?.role === "hr";

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");

  // Dialog states
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  // Selected employee for dialogs
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Add employee form state
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    email: "",
    phone: "",
    salary: "",
    dateOfJoining: new Date().toISOString().slice(0, 10),
    password: DEFAULT_EMPLOYEE_PASSWORD,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees();
  }, []);

  const filteredEmployees = employees
    .filter((employee: any) => {
      const name = (employee.name || "").toLowerCase();
      const email = (employee.email || "").toLowerCase();
      const empId = (
        employee.emp_id ||
        employee.employeeId ||
        ""
      ).toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        name.includes(query) || email.includes(query) || empId.includes(query);
      return matchesSearch;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "newest":
          return (b.created_at || "").localeCompare(a.created_at || "");
        case "oldest":
          return (a.created_at || "").localeCompare(b.created_at || "");
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

  const handleViewProfile = (employee: any) => {
    setSelectedEmployee(employee);
    setViewProfileOpen(true);
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.name || !newEmployee.email) {
      toast.error("Name and email are required");
      return;
    }

    const passwordError = getPasswordError(newEmployee.password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("name", newEmployee.name);
    formData.append("email", newEmployee.email);
    formData.append("phone", newEmployee.phone || "0000000000");
    formData.append("salary", String(newEmployee.salary || 0));
    formData.append("date_of_joining", newEmployee.dateOfJoining);
    formData.append("password", newEmployee.password);

    const success = await apiAddEmployee(formData);
    setIsSubmitting(false);

    if (success) {
      setAddEmployeeOpen(false);
      setNewEmployee({
        name: "",
        email: "",
        phone: "",
        salary: "",
        dateOfJoining: new Date().toISOString().slice(0, 10),
        password: DEFAULT_EMPLOYEE_PASSWORD,
      });
      fetchEmployees(); // Refresh
    }
  };

  const getInitials = (name: string) => {
    return (name || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getProfilePicUrl = (path: string | undefined) => {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL.replace("/api/v1", "")}/${path}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-1">
            Manage your team members ({employees.length} total)
          </p>
        </div>
        {isHr && (
          <Button onClick={() => setAddEmployeeOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
        <div className="flex gap-2 flex-wrap items-center justify-end">
          <span className="ml-auto text-sm text-muted-foreground">
            Showing {filteredEmployees.length} of {employees.length}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && employees.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            Loading employees...
          </span>
        </div>
      ) : (
        <>
          {/* Employee Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((employee: any) => (
              <Card
                key={employee.emp_id || employee.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewProfile(employee)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 border-2 border-background shadow">
                        <AvatarImage
                          src={getProfilePicUrl(employee.profile_picture)}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(employee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{employee.name}</h3>
                      </div>
                    </div>
                    {isHr && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewProfile(employee)}
                          >
                            View Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{employee.phone || "N/A"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No employees found matching your criteria.
              </p>
            </div>
          )}
        </>
      )}

      {/* View Profile Dialog */}
      <Dialog open={viewProfileOpen} onOpenChange={setViewProfileOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Profile</DialogTitle>
            <DialogDescription>
              Profile information for {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20 border-2 border-background shadow">
                  <AvatarImage
                    src={getProfilePicUrl(selectedEmployee.profile_picture)}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getInitials(selectedEmployee.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedEmployee.name}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedEmployee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Phone className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">
                      {selectedEmployee.phone || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Employee ID</p>
                    <p className="font-medium">
                      {selectedEmployee.emp_code || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="empName">Full Name *</Label>
              <Input
                id="empName"
                value={newEmployee.name}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empEmail">Email *</Label>
              <Input
                id="empEmail"
                type="email"
                value={newEmployee.email}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, email: e.target.value })
                }
                placeholder="john@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empPhone">Phone</Label>
              <Input
                id="empPhone"
                value={newEmployee.phone}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, phone: e.target.value })
                }
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empSalary">Annual Salary</Label>
              <Input
                id="empSalary"
                type="number"
                min="0"
                value={newEmployee.salary}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, salary: e.target.value })
                }
                placeholder="500000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empJoiningDate">Date of Joining</Label>
              <Input
                id="empJoiningDate"
                type="date"
                value={newEmployee.dateOfJoining}
                onChange={(e) =>
                  setNewEmployee({
                    ...newEmployee,
                    dateOfJoining: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empPassword">Password</Label>
              <Input
                id="empPassword"
                type="password"
                value={newEmployee.password}
                onChange={(e) =>
                  setNewEmployee({ ...newEmployee, password: e.target.value })
                }
                placeholder="Default password"
              />
              <PasswordRequirements
                password={newEmployee.password}
                showWhenEmpty
              />
              <p className="text-xs text-muted-foreground">
                Share this with the employee — they can change it later.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEmployeeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEmployee} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
